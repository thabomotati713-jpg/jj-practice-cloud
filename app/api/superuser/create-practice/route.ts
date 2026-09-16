import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function POST(request: Request) {
  let createdAuthUserId: string | null = null;
  let createdPracticeId: string | null = null;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

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
      .select("role, active")
      .eq("id", requestingUser.id)
      .single();

    if (
      requestingProfileError ||
      !requestingProfile ||
      requestingProfile.role !== "superuser" ||
      !requestingProfile.active
    ) {
      return NextResponse.json(
        { error: "You do not have Superuser access." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const practiceName =
      String(body.practiceName || "").trim();

    const practiceCode =
      String(body.practiceCode || "").trim();

    const practiceEmail =
      String(body.practiceEmail || "").trim();

    const practicePhone =
      String(body.practicePhone || "").trim();

    const practiceAddress =
      String(body.practiceAddress || "").trim();

    const practiceCity =
      String(body.practiceCity || "").trim();

    const practiceProvince =
      String(body.practiceProvince || "").trim();

    const practicePostalCode =
      String(body.practicePostalCode || "").trim();

    const adminFirstName =
      String(body.adminFirstName || "").trim();

    const adminLastName =
      String(body.adminLastName || "").trim();

    const adminDisplayName =
      String(body.adminDisplayName || "").trim();

    const adminEmail =
      String(body.adminEmail || "").trim().toLowerCase();

    const adminPhone =
      String(body.adminPhone || "").trim();

    const adminPassword =
      String(body.adminPassword || "");

    if (
      !practiceName ||
      !adminFirstName ||
      !adminLastName ||
      !adminEmail ||
      !adminPassword
    ) {
      return NextResponse.json(
        {
          error:
            "Practice name, administrator name, email, and password are required.",
        },
        { status: 400 }
      );
    }

    if (adminPassword.length < 8) {
      return NextResponse.json(
        {
          error:
            "The temporary password must contain at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const { data: existingPractice } =
      await adminClient
        .from("practices")
        .select("id")
        .eq("name", practiceName)
        .maybeSingle();

    if (existingPractice) {
      return NextResponse.json(
        {
          error:
            "A practice with this name already exists.",
        },
        { status: 409 }
      );
    }

    const { data: practice, error: practiceError } =
      await adminClient
        .from("practices")
        .insert({
          name: practiceName,
          practice_code: practiceCode || null,
          email: practiceEmail || null,
          phone: practicePhone || null,
          address: practiceAddress || null,
          city: practiceCity || null,
          province: practiceProvince || null,
          postal_code: practicePostalCode || null,
          active: true,
        })
        .select("id, name")
        .single();

    if (practiceError || !practice) {
      return NextResponse.json(
        {
          error:
            practiceError?.message ||
            "Could not create the practice.",
        },
        { status: 500 }
      );
    }

    createdPracticeId = practice.id;

    const {
      data: createdUser,
      error: createUserError,
    } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (createUserError || !createdUser.user) {
      await adminClient
        .from("practices")
        .delete()
        .eq("id", practice.id);

      createdPracticeId = null;

      return NextResponse.json(
        {
          error:
            createUserError?.message ||
            "Could not create the administrator login.",
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
          practice_id: practice.id,
          first_name: adminFirstName,
          last_name: adminLastName,
          display_name:
            adminDisplayName ||
            `${adminFirstName} ${adminLastName}`,
          email: adminEmail,
          phone: adminPhone || null,
          role: "owner",
          active: true,
        });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(
        createdUser.user.id
      );

      await adminClient
        .from("practices")
        .delete()
        .eq("id", practice.id);

      createdAuthUserId = null;
      createdPracticeId = null;

      return NextResponse.json(
        {
          error:
            profileError.message ||
            "Could not create the administrator profile.",
        },
        { status: 500 }
      );
    }

    // Email the owner a set-your-own-password link on top of the
    // temporary password. If the email fails, the temporary password
    // still works — report a warning instead of rolling everything back.
    let passwordLinkSent = false;

    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      const resendFromEmail = process.env.RESEND_FROM_EMAIL;

      if (resendApiKey && resendFromEmail) {
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL ||
          new URL(request.url).origin;

        const { data: linkData } = await adminClient.auth.admin
          .generateLink({
            type: "recovery",
            email: adminEmail,
            options: {
              redirectTo: `${siteUrl}/set-password`,
            },
          });

        const actionLink = linkData?.properties?.action_link;

        if (actionLink) {
          const resend = new Resend(resendApiKey);

          const { error: emailError } = await resend.emails.send({
            from: resendFromEmail,
            to: adminEmail,
            subject:
              "Your J&J Practice Cloud practice is ready — set your password",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #1f2937;">
                <div style="font-size: 14px; font-weight: 700; color: #1f7c7a; margin-bottom: 12px;">
                  J&amp;J PRACTICE CLOUD
                </div>

                <h1 style="font-size: 28px; margin: 0 0 16px;">
                  Welcome, ${adminFirstName}
                </h1>

                <p style="font-size: 16px; line-height: 1.6;">
                  Your practice <strong>${practice.name}</strong> has been set
                  up on J&amp;J Practice Cloud.
                </p>

                <p style="font-size: 16px; line-height: 1.6;">
                  A temporary password has been given to you separately. You
                  can use it to sign in right away — or set your own password
                  now using the button below.
                </p>

                <div style="margin: 30px 0;">
                  <a
                    href="${actionLink}"
                    style="
                      display: inline-block;
                      padding: 13px 22px;
                      background: #1f7c7a;
                      color: white;
                      text-decoration: none;
                      border-radius: 8px;
                      font-weight: 700;
                    "
                  >
                    Set My Password
                  </a>
                </div>

                <p style="font-size: 14px; line-height: 1.6; color: #6b7280;">
                  If you did not expect this email, you can safely ignore it.
                </p>

                <p style="font-size: 14px; line-height: 1.6; color: #6b7280;">
                  J&amp;J Practice Cloud
                </p>
              </div>
            `,
          });

          if (!emailError) {
            passwordLinkSent = true;
          }
        }
      }
    } catch (passwordLinkError) {
      console.error(
        "Owner password-setup email failed:",
        passwordLinkError
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Practice and administrator login created successfully." +
          (passwordLinkSent
            ? " A set-your-own-password link was emailed to the owner."
            : " Note: the password-setup email could not be sent — share the temporary password directly."),
        passwordLinkSent,
        practice: {
          id: practice.id,
          name: practice.name,
        },
        administrator: {
          id: createdUser.user.id,
          email: adminEmail,
          role: "owner",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Create practice error:",
      error
    );

    if (createdAuthUserId || createdPracticeId) {
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

          if (createdPracticeId) {
            await adminClient
              .from("practices")
              .delete()
              .eq("id", createdPracticeId);
          }
        }
      } catch (cleanupError) {
        console.error(
          "Create practice cleanup error:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "Could not create the practice and administrator login.",
      },
      { status: 500 }
    );
  }
}
