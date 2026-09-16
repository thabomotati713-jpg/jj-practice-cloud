import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Sick note ID is required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Verification service is not configured." },
        { status: 500 }
      );
    }

    // Service role is required here: the verification page is public
    // (no login), so the read must bypass row level security.
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: note, error: noteError } = await supabase
      .from("sick_notes")
      .select(
        `
        id,
        note_number,
        issue_date,
        start_date,
        end_date,
        created_at,
        practice_id,
        patient:patients (
          first_name,
          middle_name,
          last_name
        ),
        practice:practices (
          active
        ),
        practice_settings (
          setting_key,
          setting_value
        )
      `
      )
      .eq("id", id)
      .single();

    if (noteError || !note) {
      return NextResponse.json(
        { valid: false, reason: "Sick note not found." },
        { status: 404 }
      );
    }

    const settings: Record<string, string> = {};

    for (const row of note.practice_settings || []) {
      settings[row.setting_key] = row.setting_value || "";
    }

    const patientRecord = Array.isArray(note.patient)
      ? note.patient[0]
      : note.patient;

    const patientName = [
      patientRecord?.first_name,
      patientRecord?.middle_name,
      patientRecord?.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    return NextResponse.json({
      valid: true,
      noteNumber: note.note_number,
      issueDate: note.issue_date,
      startDate: note.start_date,
      endDate: note.end_date,
      patientName,
      practiceName:
        settings.practice_name || "J&J Practice Cloud",
      practiceCode: settings.practice_code || "",
      practicePhone: settings.phone || "",
      practiceEmail: settings.email || "",
    });
  } catch (error) {
    console.error("Sick note verification error:", error);

    return NextResponse.json(
      { error: "Could not verify the sick note." },
      { status: 500 }
    );
  }
}
