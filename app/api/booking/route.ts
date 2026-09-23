import { NextResponse } from "next/server";
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/*
 * Public appointment booking for existing patients.
 *
 * The booking page is public (no login), so every database read/write
 * here runs with the service role and the patient is verified by
 * patient number + phone number before anything is returned.
 */

const OPEN_HOUR = 8;
const CLOSE_HOUR = 17;
const SLOT_MINUTES = 30;
const BOOKING_WINDOW_MS = 10 * 60 * 1000;
const MAX_BOOKING_ATTEMPTS = 20;

const bookingAttempts = new Map<
  string,
  { count: number; resetAt: number }
>();

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const current = bookingAttempts.get(ip);

  if (!current || current.resetAt <= now) {
    bookingAttempts.set(ip, {
      count: 1,
      resetAt: now + BOOKING_WINDOW_MS,
    });
    return false;
  }

  current.count += 1;
  bookingAttempts.set(ip, current);
  return current.count > MAX_BOOKING_ATTEMPTS;
}

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, "").replace(/^\+27/, "0");
}

function buildSlots() {
  const slots: string[] = [];

  for (
    let minutes = OPEN_HOUR * 60;
    minutes < CLOSE_HOUR * 60;
    minutes += SLOT_MINUTES
  ) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;

    slots.push(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    );
  }

  return slots;
}

/*
 * Shared verification: the patient must exist, be active, and the
 * phone number must match the record. Returns practice_id too.
 */
type VerifiedPatient = {
  id: string;
  practice_id: string;
  phone: string | null;
  first_name: string | null;
  status: string | null;
};

type VerifyResult = {
  error?: string;
  patient?: VerifiedPatient;
};

async function verifyPatient(
  supabase: SupabaseClient,
  practiceId: string,
  patientNumber: string,
  phone: string
): Promise<VerifyResult> {
  const { data: patient, error } = await supabase
    .from("patients")
    .select("id, practice_id, phone, first_name, status")
    .eq("practice_id", practiceId)
    .eq("patient_id", patientNumber.trim())
    .maybeSingle();

  if (error || !patient) {
    return {
      error: "No patient found with that patient number." as string,
    };
  }

  if (patient.status && patient.status !== "active") {
    return { error: "This patient record is not active." };
  }

  if (
    !patient.phone ||
    normalizePhone(patient.phone) !== normalizePhone(phone)
  ) {
    return {
      error:
        "The phone number does not match our records. Please contact the practice.",
    };
  }

  return { patient };
}

function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function isBookableDate(date: string) {
  // Online booking must be for a future date (from tomorrow).
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return date >= tomorrow.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    if (isRateLimited(clientIp(request))) {
      return NextResponse.json(
        { error: "Too many booking attempts. Wait 10 minutes and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();

    const practiceCode = String(body.practiceCode || "").trim();
    const patientNumber = String(body.patientId || "");
    const phone = String(body.phone || "");
    const date = String(body.date || "");
    const time = String(body.time || "");

    const supabase = getSupabase();

    if (!supabase) {
      return NextResponse.json(
        { error: "Booking service is not configured." },
        { status: 500 }
      );
    }

    if (!practiceCode || !patientNumber || !phone || !isValidDate(date)) {
      return NextResponse.json(
        {
          error:
            "Practice code, patient number, phone number and a valid date are required.",
        },
        { status: 400 }
      );
    }

    const { data: practice } = await supabase
      .from("practices")
      .select("id, active")
      .eq("practice_code", practiceCode)
      .eq("active", true)
      .maybeSingle();

    if (!practice) {
      return NextResponse.json(
        { error: "The practice or patient details could not be verified." },
        { status: 401 }
      );
    }

    const verified = await verifyPatient(
      supabase,
      practice.id,
      patientNumber,
      phone
    );

    if (verified.error || !verified.patient) {
      return NextResponse.json(
        { error: verified.error },
        { status: 401 }
      );
    }

    const practiceId = practice.id;

    const { data: booked } = await supabase
      .from("appointments")
      .select("start_time, end_time, status")
      .eq("practice_id", practiceId)
      .eq("appointment_date", date)
      .neq("status", "cancelled");

    // A slot is taken when it overlaps an existing appointment.
    const bookedSlots = new Set<string>();

    for (const appointment of booked || []) {
      const start = (appointment.start_time || "").slice(0, 5);
      const end = (appointment.end_time || "").slice(0, 5);

      if (!start || !end) continue;

      const startMinutes =
        Number(start.slice(0, 2)) * 60 +
        Number(start.slice(3, 5));
      const endMinutes =
        Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));

      for (const slot of buildSlots()) {
        const slotMinutes =
          Number(slot.slice(0, 2)) * 60 +
          Number(slot.slice(3, 5));

        if (
          slotMinutes >= startMinutes &&
          slotMinutes < endMinutes
        ) {
          bookedSlots.add(slot);
        }
      }
    }

    // Booking request (final step): create the appointment.
    if (time) {
      const allowedSlots = new Set(buildSlots());

      if (!isBookableDate(date)) {
        return NextResponse.json(
          { error: "Online bookings must be for a date from tomorrow onwards." },
          { status: 400 }
        );
      }

      if (!allowedSlots.has(time)) {
        return NextResponse.json(
          { error: "Select a valid appointment time." },
          { status: 400 }
        );
      }

      if (bookedSlots.has(time)) {
        return NextResponse.json(
          { error: "That time slot is already booked." },
          { status: 409 }
        );
      }

      const slotEnd = (() => {
        const minutes =
          Number(time.slice(0, 2)) * 60 +
          Number(time.slice(3, 5)) +
          SLOT_MINUTES;

        return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
      })();

      // Appointments may require a provider; fall back to the first
      // active profile in the practice when needed.
      const { data: provider } = await supabase
        .from("profiles")
        .select("id")
        .eq("practice_id", practiceId)
        .eq("active", true)
        .limit(1)
        .single();

      const { error: insertError } = await supabase
        .from("appointments")
        .insert({
          practice_id: practiceId,
          patient_id: verified.patient.id,
          provider_id: provider?.id || null,
          appointment_date: date,
          start_time: `${time}:00`,
          end_time: slotEnd,
          appointment_type: "Consultation",
          reason: "Booked online by patient",
          status: "scheduled",
          notes: "Created via online booking portal.",
          reminder_sent: false,
        });

      if (insertError) {
        console.error("Booking insert error:", insertError);

        return NextResponse.json(
          {
            error:
              "Could not save your booking. Please try again or contact the practice.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        patientName: [
          verified.patient.first_name,
        ].filter(Boolean).join(" "),
        date,
        time,
      });
    }

    // Availability step: return open slots for the date.
    if (!isBookableDate(date)) {
      return NextResponse.json(
        {
          error:
            "Online bookings must be for a date from tomorrow onwards.",
        },
        { status: 400 }
      );
    }

    const openSlots = buildSlots().filter(
      (slot) => !bookedSlots.has(slot)
    );

    return NextResponse.json({
      success: true,
      patientName: verified.patient.first_name,
      date,
      openSlots,
    });
  } catch (error) {
    console.error("Booking error:", error);

    return NextResponse.json(
      { error: "Could not process your booking." },
      { status: 500 }
    );
  }
}
