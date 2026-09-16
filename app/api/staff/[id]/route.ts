import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/staff/[id]
 *
 * Admin-only. Removes a staff member completely: staff record,
 * login profile and the auth user. The authenticated session must
 * belong to the same practice. You cannot delete yourself.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: staffId } = await context.params;

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
        { error: "Only practice administrators can remove staff." },
        { status: 403 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: staff } = await adminClient
      .from("staff")
      .select("id, email, practice_id")
      .eq("id", staffId)
      .maybeSingle();

    if (
      !staff ||
      (staff as { practice_id: string }).practice_id !==
        (profile as { practice_id: string }).practice_id
    ) {
      return NextResponse.json(
        { error: "Staff member not found in your practice." },
        { status: 404 }
      );
    }

    if (
      (staff as { email: string | null }).email?.toLowerCase() ===
      (user.email || "").toLowerCase()
    ) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    // Find the auth user id from the profiles table before removing it.
    const { data: staffProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("staff_id", staffId)
      .maybeSingle();

    const authUserId = staffProfile
      ? (staffProfile as { id: string }).id
      : null;

    // Remove in dependency order. If a later step fails, report it —
    // the admin can retry (each step is individually idempotent).
    const { error: profileDeleteError } = await adminClient
      .from("profiles")
      .delete()
      .eq("staff_id", staffId);

    if (profileDeleteError) {
      return NextResponse.json(
        { error: profileDeleteError.message },
        { status: 500 }
      );
    }

    const { error: staffDeleteError } = await adminClient
      .from("staff")
      .delete()
      .eq("id", staffId);

    if (staffDeleteError) {
      return NextResponse.json(
        { error: staffDeleteError.message },
        { status: 500 }
      );
    }

    if (authUserId) {
      const { error: deleteUserError } =
        await adminClient.auth.admin.deleteUser(authUserId);

      if (deleteUserError) {
        return NextResponse.json(
          {
            error:
              "The staff record was removed, but their login could not be deleted. Remove it in Supabase → Authentication.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("staff delete error:", error);
    return NextResponse.json(
      { error: "Could not delete the staff member." },
      { status: 500 }
    );
  }
}
