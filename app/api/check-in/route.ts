import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 30;
const attempts = new Map<string, { count: number; resetAt: number }>();

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

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").replace(/^27/, "0");
}

function todayInSouthAfrica() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function resolvePractice(token: string) {
  const admin = adminClient();
  if (!admin) return { error: "Check-in service is not configured." };

  const { data: tokenSetting, error: tokenError } = await admin
    .from("practice_settings")
    .select("practice_id")
    .eq("setting_key", "queue_checkin_token")
    .eq("setting_value", token)
    .maybeSingle();

  if (tokenError || !tokenSetting?.practice_id) {
    return { error: "This reception QR code is not valid." };
  }

  const { data: practice, error: practiceError } = await admin
    .from("practices")
    .select("id, name, logo_url, active")
    .eq("id", tokenSetting.practice_id)
    .eq("active", true)
    .maybeSingle();

  if (practiceError || !practice) {
    return { error: "This practice is not available for check-in." };
  }

  const { data: settings } = await admin
    .from("practice_settings")
    .select("setting_key, setting_value")
    .eq("practice_id", practice.id)
    .in("setting_key", ["practice_name", "logo_url"]);

  const setting = (key: string) =>
    settings?.find((item) => item.setting_key === key)?.setting_value?.trim() || "";

  return {
    admin,
    practice: {
      ...practice,
      displayName: setting("practice_name") || practice.name,
      displayLogo: setting("logo_url") || practice.logo_url || "",
    },
  };
}

async function queuePosition(
  admin: NonNullable<ReturnType<typeof adminClient>>,
  practiceId: string,
  entryId: string
) {
  const { data } = await admin
    .from("patient_queue_entries")
    .select("id, status, queue_order_at")
    .eq("practice_id", practiceId)
    .in("status", ["waiting", "called", "in_consultation"])
    .order("queue_order_at", { ascending: true });

  const index = (data || []).findIndex((entry) => entry.id === entryId);
  return index >= 0 ? index + 1 : null;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() || "";

  if (!token) {
    return NextResponse.json({ error: "Missing check-in token." }, { status: 400 });
  }

  const resolved = await resolvePractice(token);

  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }

  return NextResponse.json({
    practiceName: resolved.practice.displayName,
    logoUrl: resolved.practice.displayLogo,
  });
}

export async function POST(request: Request) {
  try {
    if (isRateLimited(clientIp(request))) {
      return NextResponse.json(
        { error: "Too many check-in attempts. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const token = String(body.token || "").trim();
    const patientNumber = String(body.patientId || "").trim();
    const phone = String(body.phone || "").trim();

    if (!token || !patientNumber || !phone) {
      return NextResponse.json(
        { error: "Patient number and phone number are required." },
        { status: 400 }
      );
    }

    const resolved = await resolvePractice(token);

    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 404 });
    }

    const { admin, practice } = resolved;

    const { data: patient, error: patientError } = await admin
      .from("patients")
      .select("id, first_name, last_name, phone, status")
      .eq("practice_id", practice.id)
      .eq("patient_id", patientNumber)
      .maybeSingle();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: "The patient details could not be verified." },
        { status: 401 }
      );
    }

    if (patient.status && patient.status !== "active") {
      return NextResponse.json(
        { error: "This patient record is not active. Please speak to reception." },
        { status: 403 }
      );
    }

    if (!patient.phone || normalizePhone(patient.phone) !== normalizePhone(phone)) {
      return NextResponse.json(
        { error: "The patient details could not be verified." },
        { status: 401 }
      );
    }

    const { data: existing } = await admin
      .from("patient_queue_entries")
      .select("id, status, checked_in_at")
      .eq("practice_id", practice.id)
      .eq("patient_id", patient.id)
      .in("status", ["waiting", "called", "in_consultation"])
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        patientName: [patient.first_name, patient.last_name].filter(Boolean).join(" "),
        status: existing.status,
        position: await queuePosition(admin, practice.id, existing.id),
        checkedInAt: existing.checked_in_at,
      });
    }

    const today = todayInSouthAfrica();

    const { data: appointment } = await admin
      .from("appointments")
      .select("id, start_time")
      .eq("practice_id", practice.id)
      .eq("patient_id", patient.id)
      .eq("appointment_date", today)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: entry, error: insertError } = await admin
      .from("patient_queue_entries")
      .insert({
        practice_id: practice.id,
        patient_id: patient.id,
        appointment_id: appointment?.id || null,
        status: "waiting",
        source: "qr",
      })
      .select("id, checked_in_at")
      .single();

    if (insertError || !entry) {
      if (insertError?.code === "23505") {
        const { data: duplicate } = await admin
          .from("patient_queue_entries")
          .select("id, status, checked_in_at")
          .eq("practice_id", practice.id)
          .eq("patient_id", patient.id)
          .in("status", ["waiting", "called", "in_consultation"])
          .maybeSingle();

        if (duplicate) {
          return NextResponse.json({
            success: true,
            alreadyCheckedIn: true,
            patientName: [patient.first_name, patient.last_name].filter(Boolean).join(" "),
            status: duplicate.status,
            position: await queuePosition(admin, practice.id, duplicate.id),
            checkedInAt: duplicate.checked_in_at,
          });
        }
      }

      console.error("Queue check-in insert error:", insertError);
      return NextResponse.json(
        { error: "Could not add you to the queue. Please speak to reception." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      patientName: [patient.first_name, patient.last_name].filter(Boolean).join(" "),
      status: "waiting",
      position: await queuePosition(admin, practice.id, entry.id),
      checkedInAt: entry.checked_in_at,
      appointmentTime: appointment?.start_time?.slice(0, 5) || null,
    });
  } catch (error) {
    console.error("Patient QR check-in error:", error);
    return NextResponse.json(
      { error: "Could not process your check-in. Please speak to reception." },
      { status: 500 }
    );
  }
}
