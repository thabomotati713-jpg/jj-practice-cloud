import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

type PracticeSettings = Record<string, string>;

function formatDate(date: string) {
  if (!date) return "";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(time: string) {
  if (!time) return "";

  return time.slice(0, 5);
}

export async function POST(request: Request) {
  try {
    const { appointmentId } = await request.json();

    if (!appointmentId) {
      return NextResponse.json(
        { error: "Appointment ID is required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !resendApiKey ||
      !resendFromEmail
    ) {
      return NextResponse.json(
        {
          error:
            "Email service configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const resend = new Resend(resendApiKey);

    const {
      data: appointment,
      error: appointmentError,
    } = await supabase
      .from("appointments")
      .select(
        `
          id,
          practice_id,
          patient_id,
          appointment_date,
          start_time,
          end_time,
          appointment_type,
          reason,
          status
        `
      )
      .eq("id", appointmentId)
      .single();

    if (appointmentError || !appointment) {
      return NextResponse.json(
        {
          error:
            appointmentError?.message ||
            "Appointment could not be found.",
        },
        { status: 404 }
      );
    }

    if (
      appointment.status === "cancelled" ||
      appointment.status === "completed"
    ) {
      return NextResponse.json(
        {
          error:
            "Confirmation cannot be sent for a cancelled or completed appointment.",
        },
        { status: 400 }
      );
    }

    const {
      data: patient,
      error: patientError,
    } = await supabase
      .from("patients")
      .select(
        `
          id,
          patient_id,
          first_name,
          middle_name,
          last_name,
          email
        `
      )
      .eq("id", appointment.patient_id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        {
          error:
            patientError?.message ||
            "Patient could not be found.",
        },
        { status: 404 }
      );
    }

    if (!patient.email) {
      return NextResponse.json(
        {
          error:
            "This patient does not have an email address.",
        },
        { status: 400 }
      );
    }

    const {
      data: settingsRows,
      error: settingsError,
    } = await supabase
      .from("practice_settings")
      .select("setting_key, setting_value")
      .eq("practice_id", appointment.practice_id);

    if (settingsError) {
      return NextResponse.json(
        {
          error: settingsError.message,
        },
        { status: 500 }
      );
    }

    const practiceSettings: PracticeSettings = {};

    for (const row of settingsRows || []) {
      practiceSettings[row.setting_key] =
        row.setting_value || "";
    }

    const practiceName =
      practiceSettings.practice_name ||
      "Your Medical Practice";

    const practiceEmail =
      practiceSettings.email || "";

    const practicePhone =
      practiceSettings.phone || "";

    const patientName = [
      patient.first_name,
      patient.middle_name,
      patient.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    const appointmentDate = formatDate(
      appointment.appointment_date
    );

    const startTime = formatTime(
      appointment.start_time
    );

    const endTime = formatTime(
      appointment.end_time
    );

    const appointmentType =
      appointment.appointment_type ||
      "Medical Consultation";

    const reason =
      appointment.reason || "Not specified";

    const emailResult = await resend.emails.send({
      from: resendFromEmail,
      to: patient.email,
      replyTo: practiceEmail || undefined,
      subject: `Appointment Confirmation - ${practiceName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 650px; margin: 0 auto;">
          <h2 style="color: #111827;">
            Appointment Confirmation
          </h2>

          <p>Dear ${patientName},</p>

          <p>
            Your appointment with
            <strong>${practiceName}</strong>
            has been confirmed.
          </p>

          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <p><strong>Date:</strong> ${appointmentDate}</p>
            <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
            <p><strong>Appointment Type:</strong> ${appointmentType}</p>
            <p><strong>Reason:</strong> ${reason}</p>
          </div>

          <p>
            Please contact us if you need to change or cancel
            your appointment.
          </p>

          <p>
            Kind regards,<br />
            <strong>${practiceName}</strong>
            ${
              practicePhone
                ? `<br />Tel: ${practicePhone}`
                : ""
            }
            ${
              practiceEmail
                ? `<br />Email: ${practiceEmail}`
                : ""
            }
          </p>
        </div>
      `,
      text: `
Dear ${patientName},

Your appointment with ${practiceName} has been confirmed.

Date: ${appointmentDate}
Time: ${startTime} - ${endTime}
Appointment Type: ${appointmentType}
Reason: ${reason}

Please contact us if you need to change or cancel your appointment.

Kind regards,
${practiceName}
${practicePhone ? `Tel: ${practicePhone}` : ""}
${practiceEmail ? `Email: ${practiceEmail}` : ""}
      `.trim(),
    });

    if (emailResult.error) {
      console.error(
        "Resend error:",
        emailResult.error
      );

      return NextResponse.json(
        {
          error:
            emailResult.error.message ||
            "The confirmation email could not be sent.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Appointment confirmation email sent to ${patient.email}.`,
      emailId: emailResult.data?.id,
    });
  } catch (error) {
    console.error(
      "Appointment confirmation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not process appointment confirmation.",
      },
      { status: 500 }
    );
  }
}
