import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

type PracticeSettings = Record<string, string>;

/*
 * Daily appointment reminder worker.
 *
 * Called once a day by the Vercel cron schedule in vercel.json.
 * Sends an email reminder to patients for every appointment scheduled
 * for the next day (Africa/Johannesburg), then marks reminder_sent.
 *
 * Security: when CRON_SECRET is configured (recommended), requests must
 * carry "Authorization: Bearer <CRON_SECRET>" — Vercel cron does this
 * automatically.
 */

function tomorrowInJohannesburg(): string {
  const now = new Date();

  const johannesburg = new Date(
    now.getTime() + 2 * 60 * 60 * 1000
  );

  johannesburg.setUTCDate(
    johannesburg.getUTCDate() + 1
  );

  return johannesburg.toISOString().slice(0, 10);
}

function formatDate(date: string) {
  if (!date) return "";

  return new Date(`${date}T00:00:00`).toLocaleDateString(
    "en-ZA",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
}

function formatTime(time: string) {
  if (!time) return "";

  return time.slice(0, 5);
}

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      const authHeader =
        request.headers.get("authorization") || "";

      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: "Unauthorized." },
          { status: 401 }
        );
      }
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail =
      process.env.RESEND_FROM_EMAIL;

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !resendApiKey ||
      !resendFromEmail
    ) {
      return NextResponse.json(
        {
          error:
            "Reminder service configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const resend = new Resend(resendApiKey);

    const reminderDate = tomorrowInJohannesburg();

    const {
      data: appointments,
      error: appointmentsError,
    } = await supabase
      .from("appointments")
      .select(
        `
        id,
        practice_id,
        appointment_date,
        start_time,
        end_time,
        appointment_type,
        reason,
        status,
        patient:patients (
          first_name,
          middle_name,
          last_name,
          email
        )
      `
      )
      .eq("appointment_date", reminderDate)
      .in("status", ["scheduled", "confirmed"])
      .eq("reminder_sent", false);

    if (appointmentsError) {
      return NextResponse.json(
        { error: appointmentsError.message },
        { status: 500 }
      );
    }

    let sent = 0;
    let skipped = 0;
    const failures: string[] = [];

    // Cache practice settings so a batch for one
    // practice only queries them once.
    const settingsCache = new Map<
      string,
      PracticeSettings
    >();

    for (const appointment of appointments || []) {
      try {
        const patient = Array.isArray(
          appointment.patient
        )
          ? appointment.patient[0]
          : appointment.patient;

        if (!patient?.email) {
          skipped += 1;
          continue;
        }

        let practiceSettings =
          settingsCache.get(appointment.practice_id);

        if (!practiceSettings) {
          const { data: settingsRows } =
            await supabase
              .from("practice_settings")
              .select(
                "setting_key, setting_value"
              )
              .eq(
                "practice_id",
                appointment.practice_id
              );

          practiceSettings = {};

          for (const row of settingsRows || []) {
            practiceSettings[row.setting_key] =
              row.setting_value || "";
          }

          settingsCache.set(
            appointment.practice_id,
            practiceSettings
          );
        }

        const practiceName =
          practiceSettings.practice_name ||
          "Your Medical Practice";

        const practicePhone =
          practiceSettings.phone || "";

        const practiceEmail =
          practiceSettings.email || "";

        const patientName = [
          patient.first_name,
          patient.middle_name,
          patient.last_name,
        ]
          .filter(Boolean)
          .join(" ");

        const emailResult =
          await resend.emails.send({
            from: resendFromEmail,
            to: patient.email,
            replyTo:
              practiceEmail || undefined,
            subject: `Appointment Reminder - ${practiceName}`,
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 650px; margin: 0 auto;">
                <h2 style="color: #111827;">Appointment Reminder</h2>

                <p>Dear ${patientName},</p>

                <p>This is a friendly reminder of your upcoming appointment at <strong>${practiceName}</strong> tomorrow.</p>

                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
                  <p><strong>Date:</strong> ${formatDate(appointment.appointment_date)}</p>
                  <p><strong>Time:</strong> ${formatTime(appointment.start_time)} - ${formatTime(appointment.end_time)}</p>
                  <p><strong>Appointment Type:</strong> ${appointment.appointment_type || "Medical Consultation"}</p>
                  ${appointment.reason ? `<p><strong>Reason:</strong> ${appointment.reason}</p>` : ""}
                </div>

                <p>If you need to change or cancel your appointment, please contact us as soon as possible.</p>

                <p>
                  Kind regards,<br />
                  <strong>${practiceName}</strong>
                  ${practicePhone ? `<br />Tel: ${practicePhone}` : ""}
                  ${practiceEmail ? `<br />Email: ${practiceEmail}` : ""}
                </p>
              </div>
            `,
          });

        if (emailResult.error) {
          failures.push(
            `${appointment.id}: ${emailResult.error.message}`
          );

          continue;
        }

        await supabase
          .from("appointments")
          .update({ reminder_sent: true })
          .eq("id", appointment.id);

        sent += 1;
      } catch (appointmentError) {
        console.error(
          "Reminder error for appointment",
          appointment.id,
          appointmentError
        );

        failures.push(
          `${appointment.id}: unexpected error`
        );
      }
    }

    return NextResponse.json({
      success: true,
      date: reminderDate,
      found: appointments?.length || 0,
      sent,
      skipped,
      failures,
    });
  } catch (error) {
    console.error(
      "Daily reminder error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not process daily reminders.",
      },
      { status: 500 }
    );
  }
}
