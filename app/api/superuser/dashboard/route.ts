import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
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
          error: "Authentication is required.",
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
      data: profile,
      error: profileError,
    } = await adminClient
      .from("profiles")
      .select(
        "role, active, first_name, last_name, display_name"
      )
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "superuser" ||
      !profile.active
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have Superuser access.",
        },
        { status: 403 }
      );
    }

    const [
      practicesResult,
      activePracticesResult,
      usersResult,
    ] = await Promise.all([
      adminClient
        .from("practices")
        .select(
          `
            id,
            name,
            practice_code,
            email,
            phone,
            city,
            province,
            active,
            created_at
          `
        )
        .order("created_at", {
          ascending: false,
        }),

      adminClient
        .from("practices")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("active", true),

      adminClient
        .from("profiles")
        .select("id", {
          count: "exact",
          head: true,
        }),
    ]);

    if (practicesResult.error) {
      return NextResponse.json(
        {
          error:
            practicesResult.error.message,
        },
        { status: 500 }
      );
    }

    if (activePracticesResult.error) {
      return NextResponse.json(
        {
          error:
            activePracticesResult.error.message,
        },
        { status: 500 }
      );
    }

    if (usersResult.error) {
      return NextResponse.json(
        {
          error:
            usersResult.error.message,
        },
        { status: 500 }
      );
    }

    const displayName =
      profile.display_name ||
      [
        profile.first_name,
        profile.last_name,
      ]
        .filter(Boolean)
        .join(" ") ||
      user.email?.split("@")[0] ||
      "Superuser";

    return NextResponse.json({
      success: true,

      user: {
        id: user.id,
        name: displayName,
        email: user.email,
      },

      stats: {
        totalPractices:
          practicesResult.data?.length || 0,

        activePractices:
          activePracticesResult.count || 0,

        totalUsers:
          usersResult.count || 0,
      },

      practices:
        practicesResult.data || [],
    });
  } catch (error) {
    console.error(
      "Superuser dashboard API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not load the Superuser dashboard.",
      },
      { status: 500 }
    );
  }
}
