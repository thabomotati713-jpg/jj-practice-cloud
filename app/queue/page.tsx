"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type QueueEntry = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  status: "waiting" | "called" | "in_consultation" | "completed" | "cancelled";
  source: "qr" | "manual";
  checked_in_at: string;
  queue_order_at: string;
  called_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  patients:
    | {
        patient_id: string;
        first_name: string;
        last_name: string;
        phone: string | null;
      }
    | null;
  appointments:
    | {
        start_time: string | null;
        appointment_type: string | null;
        reason: string | null;
      }
    | null;
};

const activeStatuses = new Set(["waiting", "called", "in_consultation"]);

function time(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function appointmentTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "Walk-in";
}

function statusLabel(status: QueueEntry["status"]) {
  if (status === "in_consultation") return "In consultation";
  if (status === "called") return "Called";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Removed";
  return "Waiting";
}

function statusClass(status: QueueEntry["status"]) {
  if (status === "in_consultation") return "bg-indigo-100 text-indigo-800";
  if (status === "called") return "bg-amber-100 text-amber-800";
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  if (status === "cancelled") return "bg-slate-100 text-slate-600";
  return "bg-teal-100 text-teal-800";
}

export default function PatientQueuePage() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [practiceId, setPracticeId] = useState("");
  const [practiceName, setPracticeName] = useState("Your practice");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");

  const todayStart = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }, []);

  const loadQueue = useCallback(async (id: string) => {
    const { data, error: queueError } = await supabase
      .from("patient_queue_entries")
      .select(
        "id, patient_id, appointment_id, status, source, checked_in_at, queue_order_at, called_at, started_at, completed_at, patients(patient_id, first_name, last_name, phone), appointments(start_time, appointment_type, reason)"
      )
      .eq("practice_id", id)
      .gte("checked_in_at", todayStart)
      .order("queue_order_at", { ascending: true });

    if (queueError) {
      setError(queueError.message);
      return;
    }

    setEntries((data || []) as unknown as QueueEntry[]);
    setError("");
  }, [todayStart]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const boot = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("practice_id, role, active")
        .eq("id", userData.user.id)
        .single();

      if (
        profileError ||
        !profile?.practice_id ||
        !profile.active ||
        !["owner", "doctor", "reception"].includes(profile.role)
      ) {
        setError("Clinical or reception access is required to manage the patient queue.");
        setLoading(false);
        return;
      }

      setPracticeId(profile.practice_id);

      const { data: settings } = await supabase
        .from("practice_settings")
        .select("setting_key, setting_value")
        .eq("practice_id", profile.practice_id)
        .eq("setting_key", "practice_name")
        .maybeSingle();

      if (settings?.setting_value) {
        setPracticeName(settings.setting_value);
      }

      await loadQueue(profile.practice_id);

      channel = supabase
        .channel(`patient-queue-${profile.practice_id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "patient_queue_entries",
            filter: `practice_id=eq.${profile.practice_id}`,
          },
          () => {
            void loadQueue(profile.practice_id);
          }
        )
        .subscribe();

      setLoading(false);
    };

    void boot();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadQueue]);

  const act = async (action: string, entryId?: string) => {
    setError("");
    setWorkingId(entryId || action);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, entryId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not update the queue.");
        return;
      }

      if (practiceId) {
        await loadQueue(practiceId);
      }
    } catch {
      setError("Could not reach the queue service.");
    } finally {
      setWorkingId("");
    }
  };

  const active = entries.filter((entry) => activeStatuses.has(entry.status));
  const waiting = active.filter((entry) => entry.status === "waiting");
  const called = active.filter((entry) => entry.status === "called");
  const inConsult = active.filter((entry) => entry.status === "in_consultation");
  const finished = entries
    .filter((entry) => entry.status === "completed" || entry.status === "cancelled")
    .sort((a, b) => (b.completed_at || b.checked_in_at).localeCompare(a.completed_at || a.checked_in_at));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
              Live reception queue
            </p>
            <h1 className="text-xl font-semibold">{practiceName}</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/settings" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Reception QR
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section className="mb-6 grid gap-4 md:grid-cols-4">
          {[
            ["Waiting", waiting.length, "text-teal-800"],
            ["Called", called.length, "text-amber-700"],
            ["In consultation", inConsult.length, "text-indigo-700"],
            ["Finished today", finished.filter((entry) => entry.status === "completed").length, "text-emerald-700"],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className="mb-6 flex flex-col gap-3 rounded-3xl bg-gradient-to-r from-teal-950 to-slate-900 p-5 text-white shadow-xl shadow-teal-950/10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-200">Next patient</p>
            <p className="mt-1 text-sm text-white/70">
              Calls the first waiting patient in queue order.
            </p>
          </div>
          <button
            type="button"
            disabled={!waiting.length || Boolean(workingId)}
            onClick={() => void act("call-next")}
            className="rounded-2xl bg-white px-5 py-3 font-semibold text-teal-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {workingId === "call-next" ? "Calling…" : "Call next patient"}
          </button>
        </section>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Patients in line</h2>
                <p className="text-sm text-slate-500">Updates automatically when a patient scans the QR code.</p>
              </div>
              <button
                type="button"
                onClick={() => practiceId && void loadQueue(practiceId)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="p-10 text-center text-slate-500">Loading live queue…</div>
            ) : active.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal-50 text-2xl text-teal-700">✓</div>
                <h3 className="mt-4 font-semibold">No patients are waiting</h3>
                <p className="mt-1 text-sm text-slate-500">New QR check-ins will appear here automatically.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {active.map((entry, index) => {
                  const patient = entry.patients;
                  const name = patient ? `${patient.first_name} ${patient.last_name}` : "Patient";
                  return (
                    <article key={entry.id} className="p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 gap-4">
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-lg font-bold text-white">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-semibold">{name}</h3>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(entry.status)}`}>
                                {statusLabel(entry.status)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                              {patient?.patient_id || "Patient record"} · Arrived {time(entry.checked_in_at)} · Appointment {appointmentTime(entry.appointments?.start_time)}
                            </p>
                            {entry.appointments?.reason ? (
                              <p className="mt-1 truncate text-sm text-slate-600">{entry.appointments.reason}</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          {entry.status === "waiting" ? (
                            <button
                              type="button"
                              disabled={workingId === entry.id}
                              onClick={() => void act("call", entry.id)}
                              className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900"
                            >
                              Call
                            </button>
                          ) : null}

                          {entry.status === "called" || entry.status === "waiting" ? (
                            <button
                              type="button"
                              disabled={workingId === entry.id}
                              onClick={() => void act("start", entry.id)}
                              className="rounded-xl bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-900"
                            >
                              Start consult
                            </button>
                          ) : null}

                          {entry.status === "in_consultation" ? (
                            <Link
                              href={`/patients/${entry.patient_id}/consultations/new`}
                              className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-800"
                            >
                              Open consultation
                            </Link>
                          ) : null}

                          {entry.status !== "in_consultation" ? (
                            <button
                              type="button"
                              disabled={workingId === entry.id}
                              onClick={() => void act("send-back", entry.id)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                            >
                              Send to back
                            </button>
                          ) : null}

                          <button
                            type="button"
                            disabled={workingId === entry.id}
                            onClick={() => void act("complete", entry.id)}
                            className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
                          >
                            Complete
                          </button>

                          <button
                            type="button"
                            disabled={workingId === entry.id}
                            onClick={() => void act("cancel", entry.id)}
                            className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Reception flow</h2>
              <ol className="mt-4 space-y-4 text-sm text-slate-600">
                <li><strong className="text-slate-900">1.</strong> Patient scans the practice QR code.</li>
                <li><strong className="text-slate-900">2.</strong> Existing patient record is securely verified.</li>
                <li><strong className="text-slate-900">3.</strong> Patient appears here in the live queue.</li>
                <li><strong className="text-slate-900">4.</strong> Reception or doctor calls and starts the consultation.</li>
              </ol>
              <Link href="/settings" className="mt-5 block rounded-2xl bg-teal-50 px-4 py-3 text-center text-sm font-semibold text-teal-800">
                Generate / print reception QR
              </Link>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Finished today</h2>
              <div className="mt-4 space-y-3">
                {finished.length === 0 ? (
                  <p className="text-sm text-slate-500">No completed queue entries yet.</p>
                ) : (
                  finished.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="truncate text-sm">
                          {entry.patients ? `${entry.patients.first_name} ${entry.patients.last_name}` : "Patient"}
                        </strong>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(entry.status)}`}>
                          {statusLabel(entry.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.status === "completed" ? `Completed ${time(entry.completed_at)}` : "Removed from queue"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
