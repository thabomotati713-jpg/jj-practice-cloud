import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchMySpecialty } from "@/lib/specialties";
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
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication is required." },
        { status: 401 }
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
        { status: 401 }
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
      !["owner", "ADMIN", "INVENTORY"].includes(
        String((profile as { role: string }).role)
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Only practice administrators or inventory managers can load the starter catalog.",
        },
        { status: 403 }
      );
    }

    const practiceId = (profile as { practice_id: string }).practice_id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const specialty = await fetchMySpecialty(
      authClient as never,
      authClient
    );

    const catalog = SPECIALTY_CATALOGS[specialty.id] || [];

    const { data: existing } = await adminClient
      .from("inventory")
      .select("name")
      .eq("practice_id", practiceId);

    const existingNames = new Set(
      ((existing || []) as { name: string }[]).map((row) =>
        row.name.toLowerCase()
      )
    );

    const toInsert = catalog
      .filter((item) => !existingNames.has(item.name.toLowerCase()))
      .map((item) => ({
        practice_id: practiceId,
        product_code: null,
        name: item.name,
        generic_name: item.generic_name || null,
        category: item.category,
        strength: null,
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

    const { error: insertError } = await adminClient
      .from("inventory")
      .insert(toInsert);

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      added: toInsert.length,
      message: `Added ${toInsert.length} starter items for ${specialty.label} practices. Set the prices and stock counts to match your suppliers.`,
    });
  } catch (error) {
    console.error("seed-starter error:", error);
    return NextResponse.json(
      { error: "Could not load the starter catalog." },
      { status: 500 }
    );
  }
}
