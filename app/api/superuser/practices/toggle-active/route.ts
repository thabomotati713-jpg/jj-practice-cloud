import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !publishableKey ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          error:
            "Server configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    const authorization =
      request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error:
            "Authentication is required.",
        },
        { status: 401 }
      );
    }

    const accessToken =
      authorization.replace("Bearer ", "");

    const authClient = createClient(
      supabaseUrl,
      publishableKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error:
            "Your login session is invalid.",
        },
        { status: 401 }
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const {
      data: requestingProfile,
      error: profileError,
    } = await adminClient
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !requestingProfile ||
      requestingProfile.role !== "superuser" ||
      !requestingProfile.active
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have Superuser access.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const practiceId =
      String(body.practiceId || "").trim();

    const active = body.active;

    if (!practiceId || typeof active !== "boolean") {
      return NextResponse.json(
        {
          error:
            "Practice ID and active status are required.",
        },
        { status: 400 }
      );
    }

    const {
      data: practice,
      error: updateError,
    } = await adminClient
      .from("practices")
      .update({
        active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", practiceId)
      .select(
        `
          id,
          name,
          active
        `
      )
      .single();

    if (updateError || !practice) {
      return NextResponse.json(
        {
          error:
            updateError?.message ||
            "Could not update the practice.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: active
        ? "Practice activated successfully."
        : "Practice disabled successfully.",
      practice,
    });
  } catch (error) {
    console.error(
      "Toggle practice active error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not update the practice status.",
      },
      { status: 500 }
    );
  }
}
