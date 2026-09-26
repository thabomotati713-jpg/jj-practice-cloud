"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import PracticeAccessGuard from "@/components/PracticeAccessGuard";
import { supabase } from "@/lib/supabase";
import {
  type AppointmentForRisk,
  type HistoricalOutcome,
  type PatientForRisk,
  type RiskLevel,
  type ScoredAppointment,
  dateInJohannesburg,
  scoreAppointments,
  shiftCalendarDate,
} from "@/lib/ai/noShowRisk";

type Filter = "All" | RiskLevel;
const PAGE_SIZE = 500;
const MAX_ROWS = 5000;

async function loadUpcoming(practiceId: string, today: string, end: string) {
  const rows: AppointmentForRisk[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("appointments")
      .select("id, patient_id, appointment_date, start_time, status, reminder_sent")
      .eq("practice_id", practiceId)
      .gte("appointment_date", today)
      .lte("appointment_date", end)
      .in("status", ["scheduled", "confirmed"])
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < PAGE_SIZE) return rows;
  }
  throw new Error("More than 5,000 upcoming appointments were found. Narrow the date window before scoring.");
}

async function loadHistory(practiceId: string, today: string) {
  const rows: HistoricalOutcome[] = [];
  const since = shiftCalendarDate(today, -365);
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("appointments")
      .select("id, patient_id, status")
      .eq("practice_id", practiceId)
      .gte("appointment_date", since)
      .lt("appointment_date", today)
      .in("status", ["no_show", "cancelled"])
      .order("appointment_date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < PAGE_SIZE) return rows;
  }
  throw new Error("More than 5,000 historical outcomes were found. Scoring stopped rather than omitting records.");
}

async function loadPatients(practiceId: string, appointments: AppointmentForRisk[]) {
  const ids = [...new Set(appointments.map((appointment) => appointment.patient_id))];
  const rows: PatientForRisk[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await supabase.from("patients")
      .select("id, first_name, middle_name, last_name, phone, email")
      .eq("practice_id", practiceId)
      .in("id", ids.slice(offset, offset + 100));
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

function patientName(patient: PatientForRisk | null) {
  return patient
    ? [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ")
    : "Patient record unavailable";
}

function formattedDate(day: string) {
  return new Date(`${day}T12:00:00+02:00`).toLocaleDateString("en-ZA", {
    timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function NoShowContent() {
  const router = useRouter();
  const [practiceId, setPracticeId] = useState("");
  const [practiceName, setPracticeName] = useState("Your practice");
  const [scores, setScores] = useState<ScoredAppointment[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmingId, setConfirmingId] = useState("");

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setLoading(true);
      setError("");
    }
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push("/login");
        return;
      }
      const { data: profile, error: profileError } = await supabase.from("profiles")
        .select("practice_id, active, role")
        .eq("id", user.id)
        .single();
      if (profileError || !profile?.practice_id || !profile.active || profile.role === "superuser") {
        throw new Error("This account does not have access to a practice.");
      }
      const { data: practice, error: practiceError } = await supabase.from("practices")
        .select("active").eq("id", profile.practice_id).single();
      if (practiceError || !practice?.active) throw new Error("This practice is not active.");

      const id = profile.practice_id;
      setPracticeId(id);
      const today = dateInJohannesburg();
      const upcoming = await loadUpcoming(id, today, shiftCalendarDate(today, 30));
      const [history, patients, settings] = await Promise.all([
        upcoming.length ? loadHistory(id, today) : Promise.resolve([]),
        loadPatients(id, upcoming),
        supabase.from("practice_settings")
          .select("setting_value")
          .eq("practice_id", id)
          .eq("setting_key", "practice_name")
          .maybeSingle(),
      ]);
      setPracticeName(settings.data?.setting_value?.trim() || "Your practice");
      setScores(scoreAppointments(upcoming, history, patients));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load appointment priorities.");
      setScores([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function markConfirmed(item: ScoredAppointment) {
    if (!practiceId || !window.confirm(`Has ${patientName(item.patient)} confirmed this appointment?`)) return;
    setConfirmingId(item.appointment.id);
    setNotice("");
    const { data, error: updateError } = await supabase.from("appointments")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", item.appointment.id)
      .eq("practice_id", practiceId)
      .eq("status", "scheduled")
      .select("id");
    setConfirmingId("");
    if (updateError || !data?.length) {
      setError(updateError?.message || "The appointment changed. Refresh and try again.");
      return;
    }
    setNotice("Appointment marked confirmed.");
    await loadData(true);
  }

  async function copyReminder(item: ScoredAppointment) {
    if (!item.patient) return;
    const message = `Hello ${item.patient.first_name}, this is ${practiceName}. This is a reminder of your appointment on ${formattedDate(item.appointment.appointment_date)} at ${item.appointment.start_time.slice(0, 5)}. Please contact the practice to confirm or reschedule. Thank you.`;
    try {
      await navigator.clipboard.writeText(message);
      setNotice("Generic reminder copied. Verify the recipient and send it manually.");
    } catch {
      setError("Clipboard access failed. Please contact the patient manually.");
    }
  }

  const visible = filter === "All" ? scores : scores.filter((item) => item.level === filter);
  const counts = {
    High: scores.filter((item) => item.level === "High").length,
    Medium: scores.filter((item) => item.level === "Medium").length,
    Low: scores.filter((item) => item.level === "Low").length,
  };
  const badge = {
    High: "badge badge-red",
    Medium: "badge badge-amber",
    Low: "badge badge-green",
  };

  return (
    <main className="page-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <a href="/dashboard" className="app-brand">
            <Image src="/logo.jpg" alt="J&J Practice Cloud" width={36} height={36} className="app-brand-logo" />
            <span className="app-brand-name">J&J Practice Cloud</span>
          </a>
          <div className="page-actions">
            <a href="/appointments" className="btn btn-secondary btn-sm">Appointments</a>
            <a href="/dashboard" className="btn btn-secondary btn-sm">Dashboard</a>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1f7c7a]">J&J AI · Phase 1</p>
            <h1 className="page-title mt-2">Appointment follow-up</h1>
            <p className="page-subtitle">Prioritise upcoming visits using recorded attendance history and confirmation status.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => loadData(true)} disabled={loading}>
            ↻ Refresh priorities
          </button>
        </div>

        <div className="card mb-5 p-5 text-sm text-slate-700">
          <strong>Scheduling priority, not a probability.</strong> The score is an explainable rule-based guide.
          It uses this practice&apos;s explicit appointment outcomes from the past year; a missing check-in
          is never treated as a no-show. The window covers the next 30 days in South African time.
        </div>

        {error && <div role="alert" className="alert-error mb-5">{error}</div>}
        {notice && <div role="status" className="alert-info mb-5">{notice}</div>}

        <div className="stat-grid mb-6">
          {(["All", "High", "Medium", "Low"] as const).map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={filter === level}
              onClick={() => setFilter(level)}
              className={`stat-card cursor-pointer text-left ${filter === level ? "ring-2 ring-[#1f7c7a]" : ""}`}
            >
              <div className="stat-label">{level === "All" ? "Upcoming" : `${level} priority`}</div>
              <div className="stat-value">{loading ? "—" : level === "All" ? scores.length : counts[level]}</div>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card p-10 text-center text-slate-500">Loading appointment priorities...</div>
        ) : !error && visible.length === 0 ? (
          <div className="card p-10 text-center text-slate-500">
            {scores.length ? `No ${filter.toLowerCase()} priority appointments.` : "No upcoming appointments found."}
          </div>
        ) : (
          <div className="grid gap-4">
            {visible.map((item) => (
              <article key={item.appointment.id} className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{patientName(item.patient)}</h2>
                    <p className="page-subtitle">
                      {formattedDate(item.appointment.appointment_date)} · {item.appointment.start_time.slice(0, 5)}
                      {item.patient?.phone ? ` · ${item.patient.phone}` : " · No phone saved"}
                    </p>
                  </div>
                  <span className={badge[item.level]}>{item.level} · {item.score}/100</span>
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-700">Why this score</p>
                <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
                  {item.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
                <p className="mt-4 rounded-xl bg-[#effaf8] p-3 text-sm text-slate-700">
                  <strong>Suggested follow-up:</strong> {item.action}
                </p>
                <div className="page-actions mt-4">
                  <a className="btn btn-secondary btn-sm" href={`/appointments/${item.appointment.id}/edit`}>View appointment</a>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyReminder(item)} disabled={!item.patient}>
                    Copy generic reminder
                  </button>
                  {item.appointment.status !== "confirmed" && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => markConfirmed(item)} disabled={confirmingId === item.appointment.id}>
                      {confirmingId === item.appointment.id ? "Saving..." : "Mark confirmed"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="mt-6 text-xs text-slate-500">
          Copying a reminder does not send it or mark it as sent. Verify the patient&apos;s contact details before messaging.
          No patient data is sent to a generative AI service by this module.
        </p>
      </div>
    </main>
  );
}

export default function NoShowPage() {
  return <PracticeAccessGuard><NoShowContent /></PracticeAccessGuard>;
}
