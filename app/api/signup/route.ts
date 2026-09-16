import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { SPECIALTIES } from "../../../lib/specialties";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_BODY_BYTES = 20_000;
const ALLOWED_PLANS = new Set(["solo", "group"]);
const ALLOWED_PROVINCES = new Set([
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
]);
const ALLOWED_SPECIALTIES = new Set<string>(
  SPECIALTIES.map((item) => item.id)
);

function clean(value: unknown, max = 160) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] || character);
}

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const current = attempts.get(ip);
  if (!current || current.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  attempts.set(ip, current);
  return current.count > MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many registration attempts. Wait 15 minutes and try again." },
      { status: 429 }
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "The registration request is too large." }, { status: 413 });
  }

  let practiceId: string | null = null;
  let authUserId: string | null = null;
  let staffId: string | null = null;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Registration is temporarily unavailable." }, { status: 503 });
    }

    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "The registration request is too large." }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "The registration details are invalid." }, { status: 400 });
    }

    if (clean(body.website, 200)) {
      return NextResponse.json({ success: true }, { status: 201 });
    }

    const plan = clean(body.plan, 10).toLowerCase();
    const practiceName = clean(body.practiceName, 100);
    const specialty = clean(body.specialty, 30).toLowerCase();
    const firstName = clean(body.firstName, 60);
    const lastName = clean(body.lastName, 60);
    const email = clean(body.email, 160).toLowerCase();
    const phone = clean(body.phone, 24);
    const city = clean(body.city, 80);
    const province = clean(body.province, 40);
    const password = String(body.password ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");
    const acceptTerms = body.acceptTerms === true;

    if (!ALLOWED_PLANS.has(plan) || !ALLOWED_SPECIALTIES.has(specialty)) {
      return NextResponse.json({ error: "Select a valid plan and practice type." }, { status: 400 });
    }
    if (!practiceName || !firstName || !lastName || !email || !phone || !city || !province) {
      return NextResponse.json({ error: "Complete every required registration field." }, { status: 400 });
    }
    if (!ALLOWED_PROVINCES.has(province)) {
      return NextResponse.json({ error: "Select a valid South African province." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (phone.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
    }
    if (password.length < 10 || password.length > 100 || password !== confirmPassword) {
      return NextResponse.json({ error: "Use matching passwords with at least 10 characters." }, { status: 400 });
    }
    if (!acceptTerms) {
      return NextResponse.json({ error: "Registration authority must be confirmed." }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [{ data: matchingPractice }, { data: matchingProfile }] = await Promise.all([
      admin.from("practices").select("id").ilike("name", practiceName).limit(1).maybeSingle(),
      admin.from("profiles").select("id").eq("email", email).limit(1).maybeSingle(),
    ]);

    if (matchingPractice) {
      return NextResponse.json({ error: "A practice with this name is already registered." }, { status: 409 });
    }
    if (matchingProfile) {
      return NextResponse.json({ error: "This email already has a J&J Practice Cloud account." }, { status: 409 });
    }

    const { data: practice, error: practiceError } = await admin
      .from("practices")
      .insert({
        name: practiceName,
        email,
        phone,
        city,
        province,
        active: true,
      })
      .select("id")
      .single();

    if (practiceError || !practice) {
      console.error("Public signup practice error:", practiceError?.message);
      return NextResponse.json({ error: "The practice could not be registered." }, { status: 500 });
    }
    practiceId = practice.id;

    const { data: createdUser, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (userError || !createdUser.user) {
      await admin.from("practices").delete().eq("id", practiceId);
      practiceId = null;
      const duplicate = userError?.message.toLowerCase().includes("already");
      return NextResponse.json(
        { error: duplicate ? "This email already has a J&J Practice Cloud account." : "The owner login could not be created." },
        { status: duplicate ? 409 : 500 }
      );
    }
    authUserId = createdUser.user.id;

    let { data: staff, error: staffError } = await admin
      .from("staff")
      .insert({
        practice_id: practiceId,
        first_name: firstName,
        last_name: lastName,
        display_name: `${firstName} ${lastName}`,
        email,
        phone,
        role: "ADMIN",
        specialty,
        active: true,
      })
      .select("id")
      .single();

    if (staffError) {
      const retry = await admin
        .from("staff")
        .insert({
          practice_id: practiceId,
          first_name: firstName,
          last_name: lastName,
          display_name: `${firstName} ${lastName}`,
          email,
          phone,
          role: "ADMIN",
          active: true,
        })
        .select("id")
        .single();
      staff = retry.data;
      staffError = retry.error;
    }

    if (staffError || !staff) {
      console.error("Public signup staff error:", staffError?.message);
      await admin.auth.admin.deleteUser(authUserId);
      await admin.from("practices").delete().eq("id", practiceId);
      authUserId = null;
      practiceId = null;
      return NextResponse.json({ error: "The practice owner record could not be created." }, { status: 500 });
    }
    staffId = staff.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: authUserId,
      practice_id: practiceId,
      staff_id: staffId,
      first_name: firstName,
      last_name: lastName,
      display_name: `${firstName} ${lastName}`,
      email,
      phone,
      role: "owner",
      active: true,
    });

    if (profileError) {
      console.error("Public signup profile error:", profileError.message);
      await admin.from("staff").delete().eq("id", staffId);
      await admin.auth.admin.deleteUser(authUserId);
      await admin.from("practices").delete().eq("id", practiceId);
      staffId = null;
      authUserId = null;
      practiceId = null;
      return NextResponse.json({ error: "The owner account could not be completed." }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const specialtyLabel = SPECIALTIES.find((item) => item.id === specialty)?.label || "Healthcare Practice";
    let emailSent = false;

    if (resendKey && fromEmail) {
      try {
        const resend = new Resend(resendKey);
        const safeName = escapeHtml(firstName);
        const safePractice = escapeHtml(practiceName);
        const safePlan = plan === "group" ? "Group — R949/month" : "Solo — R549/month";

        const ownerResult = await resend.emails.send({
          from: fromEmail,
          to: email,
          replyTo: "jjpracticecloud@gmail.com",
          subject: "Your J&J Practice Cloud practice is ready",
          html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:32px;color:#0f1f2d"><p style="font-weight:800;color:#1f7c7a">J&amp;J PRACTICE CLOUD</p><h1>Welcome, ${safeName}</h1><p>Your workspace for <strong>${safePractice}</strong> has been created on the <strong>${safePlan}</strong> plan.</p><p>You can sign in immediately with the password you created during registration.</p><p style="margin:28px 0"><a href="${siteUrl}/login" style="background:#1f7c7a;color:white;padding:13px 22px;border-radius:10px;text-decoration:none;font-weight:700">Sign in to your practice</a></p><p>The once-off R1 999 activation fee is only invoiced after guided onboarding is confirmed.</p><p>Questions? Reply to this email or WhatsApp 060 112 8855.</p></div>`,
        });
        emailSent = !ownerResult.error;

        await resend.emails.send({
          from: fromEmail,
          to: "jjpracticecloud@gmail.com",
          replyTo: email,
          subject: `New ${safePlan} registration — ${safePractice}`,
          html: `<div style="font-family:Arial,sans-serif;padding:24px"><h2>New online practice registration</h2><p><strong>Practice:</strong> ${safePractice}</p><p><strong>Owner:</strong> ${escapeHtml(`${firstName} ${lastName}`)}</p><p><strong>Plan:</strong> ${safePlan}</p><p><strong>Type:</strong> ${escapeHtml(specialtyLabel)}</p><p><strong>Location:</strong> ${escapeHtml(`${city}, ${province}`)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Phone:</strong> ${escapeHtml(phone)}</p></div>`,
        });
      } catch (emailError) {
        console.error("Public signup email error:", emailError);
      }
    }

    return NextResponse.json({ success: true, emailSent }, { status: 201 });
  } catch (error) {
    console.error("Public signup error:", error);
    if (practiceId) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && serviceRoleKey) {
          const admin = createClient(supabaseUrl, serviceRoleKey);
          if (staffId) await admin.from("staff").delete().eq("id", staffId);
          if (authUserId) await admin.auth.admin.deleteUser(authUserId);
          await admin.from("practices").delete().eq("id", practiceId);
        }
      } catch (cleanupError) {
        console.error("Public signup cleanup error:", cleanupError);
      }
    }
    return NextResponse.json({ error: "Registration could not be completed. Try again or contact us." }, { status: 500 });
  }
}
