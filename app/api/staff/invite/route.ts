import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_ROLES = [
  "ADMIN",
  "DOCTOR",
  "RECEPTIONIST",
  "FINANCE",
  "NURSE",
  "INVENTORY",
];

export async function POST(request: Request) {
  let createdAuthUserId: string | null = null;
  let createdStaffId: string | null = null;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;

    if (
      !supabaseUrl ||
      !publishableKey ||
      !serviceRoleKey ||
      !resendApiKey ||
      !resendFromEmail
    ) {
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

    const accessToken = authorization.replace("Bearer ", "");

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
      data: { user: requestingUser },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !requestingUser) {
      return NextResponse.json(
        { error: "Your login session is invalid." },
        { status: 401 }
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const {
      data: requestingProfile,
      error: requestingProfileError,
    } = await adminClient
      .from("profiles")
      .select("practice_id, role, active")
      .eq("id", requestingUser.id)
      .single();

    if (
      requestingProfileError ||
      !requestingProfile ||
      !requestingProfile.practice_id ||
      !requestingProfile.active ||
      !["owner", "ADMIN"].includes(requestingProfile.role)
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to add staff members.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const displayName = String(body.display_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const role = String(body.role || "").trim().toUpperCase();
    const active = body.active !== false;

    const profileRoleMap: Record<string, string> = {
      ADMIN: "admin",
      DOCTOR: "doctor",
      RECEPTIONIST: "reception",
      FINANCE: "billing",
      NURSE: "nurse",
      INVENTORY: "pharmacy",
    };

    const profileRole = profileRoleMap[role];

    if (!firstName || !lastName || !email || !role) {
      return NextResponse.json(
        {
          error:
            "First name, last name, email, and role are required.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Invalid staff role." },
        { status: 400 }
      );
    }

    const { data: existingStaff } = await adminClient
      .from("staff")
      .select("id")
      .eq("practice_id", requestingProfile.practice_id)
      .eq("email", email)
      .maybeSingle();

    if (existingStaff) {
      return NextResponse.json(
        {
          error:
            "A staff member with this email already exists in this practice.",
        },
        { status: 409 }
      );
    }

    const { data: createdStaff, error: staffError } =
      await adminClient
        .from("staff")
        .insert({
          practice_id: requestingProfile.practice_id,
          first_name: firstName,
          last_name: lastName,
          display_name:
            displayName || `${firstName} ${lastName}`,
          email,
          phone: phone || null,
          role,
          active,
        })
        .select("id")
        .single();

    if (staffError || !createdStaff) {
      return NextResponse.json(
        {
          error:
            staffError?.message ||
            "Could not create the staff record.",
        },
        { status: 500 }
      );
    }

    createdStaffId = createdStaff.id;

    const { data: createdUser, error: createUserError } =
      await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
      });

    if (createUserError || !createdUser.user) {
      await adminClient
        .from("staff")
        .delete()
        .eq("id", createdStaff.id);

      createdStaffId = null;

      return NextResponse.json(
        {
          error:
            createUserError?.message ||
            "Could not create the staff login.",
        },
        { status: 500 }
      );
    }

    createdAuthUserId = createdUser.user.id;

    const { error: profileError } =
      await adminClient
        .from("profiles")
        .insert({
          id: createdUser.user.id,
          practice_id: requestingProfile.practice_id,
          first_name: firstName,
          last_name: lastName,
          display_name:
            displayName || `${firstName} ${lastName}`,
          email,
          phone: phone || null,
          role: profileRole,
          active,
          staff_id: createdStaff.id,
        });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(
        createdUser.user.id
      );

      await adminClient
        .from("staff")
        .delete()
        .eq("id", createdStaff.id);

      createdAuthUserId = null;
      createdStaffId = null;

      return NextResponse.json(
        {
          error:
            profileError.message ||
            "Could not create the staff profile.",
        },
        { status: 500 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const redirectTo = `${siteUrl}/set-password`;

    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      await adminClient
        .from("profiles")
        .delete()
        .eq("id", createdUser.user.id);

      await adminClient.auth.admin.deleteUser(
        createdUser.user.id
      );

      await adminClient
        .from("staff")
        .delete()
        .eq("id", createdStaff.id);

      createdAuthUserId = null;
      createdStaffId = null;

      return NextResponse.json(
        {
          error:
            linkError?.message ||
            "Could not create the password setup link.",
        },
        { status: 500 }
      );
    }

    const actionLink = linkData.properties.action_link;

    const resend = new Resend(resendApiKey);

    const { error: emailError } = await resend.emails.send({
      from: resendFromEmail,
      to: email,
      subject: "You've been invited to J&J Practice Cloud",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #1f2937;">
          <div style="font-size: 14px; font-weight: 700; color: #2563eb; margin-bottom: 12px;">
            J&J PRACTICE CLOUD
          </div>

          <h1 style="font-size: 28px; margin: 0 0 16px;">
            You've been invited
          </h1>

          <p style="font-size: 16px; line-height: 1.6;">
            Hello ${firstName},
          </p>

          <p style="font-size: 16px; line-height: 1.6;">
            You have been invited to join J&J Practice Cloud as a
            <strong>${role}</strong>.
          </p>

          <p style="font-size: 16px; line-height: 1.6;">
            Click the button below to create your password and activate
            your staff account.
          </p>

          <div style="margin: 30px 0;">
            <a
              href="${actionLink}"
              style="
                display: inline-block;
                padding: 13px 22px;
                background: #2563eb;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 700;
              "
            >
              Create Your Password
            </a>
          </div>

          <p style="font-size: 14px; line-height: 1.6; color: #6b7280;">
            If you did not expect this invitation, you can safely ignore
            this email.
          </p>

          <p style="font-size: 14px; line-height: 1.6; color: #6b7280;">
            J&J Practice Cloud
          </p>
        </div>
      `,
    });

    if (emailError) {
      await adminClient
        .from("profiles")
        .delete()
        .eq("id", createdUser.user.id);

      await adminClient.auth.admin.deleteUser(
        createdUser.user.id
      );

      await adminClient
        .from("staff")
        .delete()
        .eq("id", createdStaff.id);

      createdAuthUserId = null;
      createdStaffId = null;

      return NextResponse.json(
        {
          error:
            emailError.message ||
            "Staff account was created but the invitation email could not be sent.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Staff member created and invitation email sent successfully.",
        staff: {
          id: createdStaff.id,
          name:
            displayName || `${firstName} ${lastName}`,
          email,
          role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Staff invitation error:", error);

    try {
      const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && serviceRoleKey) {
        const adminClient = createClient(
          supabaseUrl,
          serviceRoleKey
        );

        if (createdAuthUserId) {
          await adminClient.auth.admin.deleteUser(
            createdAuthUserId
          );
        }

        if (createdStaffId) {
          await adminClient
            .from("staff")
            .delete()
            .eq("id", createdStaffId);
        }
      }
    } catch (cleanupError) {
      console.error(
        "Staff invitation cleanup error:",
        cleanupError
      );
    }

    return NextResponse.json(
      {
        error:
          "Could not create the staff member and invitation.",
      },
      { status: 500 }
    );
  }
}
