import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { fetchMySpecialty, SPECIALTIES, getSpecialty } from "@/lib/specialties";
import { MEDICATION_CATALOG, catalogKey } from "@/lib/medication-catalog";
import { SPECIALTY_CATALOGS } from "@/lib/specialty-catalog";

export const dynamic = "force-dynamic";

/**
 * POST /api/inventory/seed-starter
 *
 * Loads the starter catalog for the current user's specialty into the
 * practice's inventory (stock counts start at 0). Idempotent: items
 * whose name already exists in the practice are skipped.
 */
export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration is incomplete." },
        { status: 500 },
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication is required." },
        { status: 401 },
      );
    }

    const accessToken = authorization.slice("Bearer ".length);

    const authClient = createClient(supabaseUrl, publishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Your login session is invalid." },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await authClient
      .from("profiles")
      .select("practice_id, role, active")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile?.active ||
      !profile.practice_id ||
      !["owner", "admin", "inventory"].includes(
        String((profile as { role: string }).role).toLowerCase(),
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Only practice administrators or inventory managers can load the starter catalog.",
        },
        { status: 403 },
      );
    }

    const practiceId = (profile as { practice_id: string }).practice_id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: practice, error: practiceError } = await adminClient
      .from("practices")
      .select("active")
      .eq("id", practiceId)
      .single();
    if (practiceError || !practice?.active) {
      return NextResponse.json(
        { error: "Your practice is inactive or unavailable." },
        { status: 403 },
      );
    }
    const rawBody = await request.text();
    let body: { specialty?: string; medications?: string[] } = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json(
        { error: "Invalid catalogue selection." },
        { status: 400 },
      );
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      (body.specialty !== undefined &&
        !SPECIALTIES.some((s) => s.id === body.specialty))
    ) {
      return NextResponse.json(
        { error: "Select a supported speciality." },
        { status: 400 },
      );
    }
    if (
      body.medications !== undefined &&
      (!Array.isArray(body.medications) ||
        body.medications.length < 1 ||
        body.medications.length > 200 ||
        body.medications.some(
          (name) =>
            typeof name !== "string" ||
            !MEDICATION_CATALOG.some((item) => item.name === name),
        ))
    ) {
      return NextResponse.json(
        { error: "Choose between 1 and 200 supported medication templates." },
        { status: 400 },
      );
    }
    const specialty = body.specialty
      ? getSpecialty(body.specialty)
      : await fetchMySpecialty(authClient as never, authClient);

    const catalog = body.medications
      ? MEDICATION_CATALOG.filter((item) =>
          body.medications!.includes(item.name),
        )
      : SPECIALTY_CATALOGS[specialty.id] || [];

    // Read every page: a practice can have more than PostgREST's row cap.
    const existingNames = new Set<string>();
    for (let offset = 0; ; offset += 1000) {
      const { data: existing, error: existingError } = await adminClient
        .from("inventory_products")
        .select("name")
        .eq("practice_id", practiceId)
        .order("id")
        .range(offset, offset + 999);
      if (existingError) {
        console.error("Starter inventory lookup failed", existingError);
        return NextResponse.json(
          { error: "Could not read inventory. Please try again." },
          { status: 500 },
        );
      }
      for (const row of existing || []) existingNames.add(catalogKey(row.name));
      if (!existing || existing.length < 1000) break;
    }

    const toInsert = catalog
      .filter((item) => {
        const key = catalogKey(item.name);
        if (existingNames.has(key)) return false;
        existingNames.add(key);
        return true;
      })
      .map((item) => ({
        practice_id: practiceId,
        product_code: `STARTER-${createHash("sha256").update(catalogKey(item.name)).digest("hex").slice(0, 24)}`,
        name: item.name,
        generic_name: item.generic_name || null,
        category: item.category,
        strength: item.strength || null,
        dosage_form: item.dosage_form || null,
        manufacturer: null,
        unit: item.unit || null,
        purchase_price: 0,
        selling_price: 0,
        current_stock: 0,
        minimum_stock: item.minimum_stock,
        prescription_required: item.prescription_required || false,
        active: true,
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({
        ok: true,
        added: 0,
        message:
          "Everything in the starter catalog is already in your inventory.",
      });
    }

    const { data: inserted, error: insertError } = await adminClient
      .from("inventory_products")
      .upsert(toInsert, {
        onConflict: "practice_id,product_code",
        ignoreDuplicates: true,
      })
      .select("id");

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      added: inserted?.length || 0,
      message: `Added ${inserted?.length || 0} ${body.medications ? "medication templates" : "starter items for " + specialty.label}. Existing products were preserved. Review product details, units, prices and prescription requirements before receiving stock.`,
    });
  } catch (error) {
    console.error("seed-starter error:", error);
    return NextResponse.json(
      { error: "Could not load the starter catalog." },
      { status: 500 },
    );
  }
}
