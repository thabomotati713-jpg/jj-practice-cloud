"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string | null;
  appointment_type: string | null;
  reason: string | null;
  status: string | null;
  notes: string | null;
};

type Patient = {
  id: string;
  patient_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

export default function AppointmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    appointment_date: "",
    start_time: "",
    end_time: "",
    appointment_type: "Consultation",
    reason: "",
    status: "scheduled",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const routeParams = await params;

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      setError("Your practice profile could not be found.");
      setLoading(false);
      return;
    }

    const { data: patientData, error: patientError } = await supabase
      .from("patients")
      .select("id, patient_id, first_name, middle_name, last_name")
      .eq("id", routeParams.id)
      .eq("practice_id", profile.practice_id)
      .single();

    if (patientError || !patientData) {
      setError("Patient could not be found.");
      setLoading(false);
      return;
    }

    setPatient(patientData as Patient);

    const { data: appointmentData, error: appointmentError } =
      await supabase
        .from("appointments")
        .select(
          "id, appointment_date, start_time, end_time, appointment_type, reason, status, notes"
        )
        .eq("patient_id", routeParams.id)
        .eq("practice_id", profile.practice_id)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false });

    if (appointmentError) {
      setError(appointmentError.message);
    } else {
      setAppointments((appointmentData || []) as Appointment[]);
    }

    setLoading(false);
  };

  const updateField = (name: string, value: string) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patient) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      setError("Your practice profile could not be found.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("appointments")
      .insert({
        practice_id: profile.practice_id,
        patient_id: patient.id,
        provider_id: userData.user.id,
        appointment_date: form.appointment_date,
        start_time: form.start_time,
        end_time: form.end_time || null,
        appointment_type: form.appointment_type || null,
        reason: form.reason || null,
        status: form.status || "scheduled",
        notes: form.notes || null,
        reminder_sent: false,
      });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSuccess("Appointment added successfully.");

    setForm({
      appointment_date: "",
      start_time: "",
      end_time: "",
      appointment_type: "Consultation",
      reason: "",
      status: "scheduled",
      notes: "",
    });

    setSaving(false);

    await loadData();
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-500">Loading appointments...</p>
      </main>
    );
  }

  if (!patient) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-red-600">
            {error || "Patient could not be found."}
          </p>
        </div>
      </main>
    );
  }

  const fullName = [
    patient.first_name,
    patient.middle_name,
    patient.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              J&J PRACTICE CLOUD
            </h1>
            <p className="text-sm text-slate-500">
              Appointments
            </p>
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => {
              window.location.href = `/patients/${patient.id}`;
            }}
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            ← Patient Profile
          </button>

          <div>
            <p className="text-sm font-semibold text-blue-700">
              {patient.patient_id}
            </p>

            <h2 className="text-2xl font-bold text-slate-900">
              {fullName}
            </h2>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Add Appointment */}
          <section className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-1">
            <h3 className="mb-5 text-xl font-semibold text-slate-900">
              New Appointment
            </h3>

            <form onSubmit={handleAddAppointment} className="space-y-4">
              <div>
                <label
                  htmlFor="appointment_date"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Date
                </label>

                <input
                  id="appointment_date"
                  type="date"
                  required
                  value={form.appointment_date}
                  onChange={(e) =>
                    updateField("appointment_date", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="start_time"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Start time
                  </label>

                  <input
                    id="start_time"
                    type="time"
                    required
                    value={form.start_time}
                    onChange={(e) =>
                      updateField("start_time", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="end_time"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    End time
                  </label>

                  <input
                    id="end_time"
                    type="time"
                    value={form.end_time}
                    onChange={(e) =>
                      updateField("end_time", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="appointment_type"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Appointment type
                </label>

                <select
                  id="appointment_type"
                  value={form.appointment_type}
                  onChange={(e) =>
                    updateField("appointment_type", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >
                  <option>Consultation</option>
                  <option>Follow-up</option>
                  <option>Procedure</option>
                  <option>Review</option>
                  <option>Emergency</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="reason"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Reason
                </label>

                <input
                  id="reason"
                  type="text"
                  value={form.reason}
                  onChange={(e) =>
                    updateField("reason", e.target.value)
                  }
                  placeholder="Reason for appointment"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Status
                </label>

                <select
                  id="status"
                  value={form.status}
                  onChange={(e) =>
                    updateField("status", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Notes
                </label>

                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) =>
                    updateField("notes", e.target.value)
                  }
                  rows={4}
                  placeholder="Appointment notes..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Add Appointment"}
              </button>
            </form>
          </section>

          {/* Appointment List */}
          <section className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-5">
              <h3 className="text-xl font-semibold text-slate-900">
                Appointment History
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                All appointments for this patient
              </p>
            </div>

            {appointments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
                <p className="font-medium text-slate-700">
                  No appointments yet
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Use the form to create the first appointment.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-xl border border-slate-200 p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {appointment.appointment_type ||
                            "Appointment"}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          {appointment.appointment_date}
                          {" · "}
                          {appointment.start_time}
                          {appointment.end_time
                            ? ` – ${appointment.end_time}`
                            : ""}
                        </p>
                      </div>

                      <span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {appointment.status || "scheduled"}
                      </span>
                    </div>

                    {appointment.reason && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Reason
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {appointment.reason}
                        </p>
                      </div>
                    )}

                    {appointment.notes && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Notes
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {appointment.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
