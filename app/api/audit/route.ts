import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * POST /api/audit — record an audit event.
 * GET  /api/audit — read the practice's recent audit trail (admins only).
 *
 * Writes happen with the service role (the audit table is RLS-locked
 * with no policies, so a user token can never touch it directly).
 * Identity always comes from the validated session, never from the
 * request body — callers cannot log events as someone else.
 */

type AuditAction = "view" | "create" | "update" | "delete" | "print";

const ALLOWED_ACTIONS: AuditAction[] = [
  "view",
  "create",
  "update",
  "delete",
  "print",
];

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
      .select("practice_id, active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.active || !profile.practice_id) {
      return NextResponse.json(
        { error: "You do not have permission to do this." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const action = String(body.action || "").trim() as AuditAction;
    const entity = String(body.entity || "").trim();
    const entityId = String(body.entity_id || "").trim() || null;
    const details = String(body.details || "").trim().slice(0, 500) || null;

    if (!ALLOWED_ACTIONS.includes(action) || !entity) {
      return NextResponse.json(
        { error: "Invalid audit event." },
        { status: 400 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: insertError } = await adminClient
      .from("audit_log")
      .insert({
        practice_id: profile.practice_id,
        user_id: user.id,
        user_email: user.email || null,
        action,
        entity,
        entity_id: entityId,
        details,
      });

    if (insertError) {
      // Missing table (pre-migration) or transient failure: never break
      // the user's workflow over logging — surface as accepted-but-logged.
      console.error("audit insert failed:", insertError);
      return NextResponse.json({ ok: true, recorded: false });
    }

    return NextResponse.json({ ok: true, recorded: true });
  } catch (error) {
    console.error("audit POST error:", error);
    return NextResponse.json(
      { error: "Audit logging failed." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
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
      !["owner", "ADMIN"].includes(
        String((profile as { role: string }).role)
      )
    ) {
      return NextResponse.json(
        { error: "Only practice administrators can view the audit trail." },
        { status: 403 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data, error: readError } = await adminClient
      .from("audit_log")
      .select(
        "id, user_email, action, entity, entity_id, details, created_at"
      )
      .eq("practice_id", profile.practice_id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (readError) {
      // Pre-migration database: return an empty trail, not an error page.
      return NextResponse.json({ events: [] });
    }

    return NextResponse.json({ events: data || [] });
  } catch (error) {
    console.error("audit GET error:", error);
    return NextResponse.json(
      { error: "Could not load the audit trail." },
      { status: 500 }
    );
  }
}
