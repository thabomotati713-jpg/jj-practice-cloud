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

function statusBadgeClass(status: string | null): string {
  const value = (status || "scheduled").toLowerCase();

  if (["completed", "active", "paid", "in stock"].includes(value)) {
    return "badge badge-green";
  }

  if (
    ["scheduled", "confirmed", "pending", "submitted", "partially paid"].includes(
      value
    )
  ) {
    return "badge badge-blue";
  }

  if (["no_show", "no show", "low stock"].includes(value)) {
    return "badge badge-amber";
  }

  if (["cancelled", "rejected", "overdue", "out of stock"].includes(value)) {
    return "badge badge-red";
  }

  return "badge badge-gray";
}

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
      <main className="page-shell">
        <div className="page-inner">
          <p className="empty-state">Loading appointments...</p>
        </div>
      </main>
    );
  }

  if (!patient) {
    return (
      <main className="page-shell">
        <header className="app-header">
          <div className="app-header-inner">
            <a href="/dashboard" className="app-brand">
              <img
                src="/logo.jpg"
                alt="J&J Practice Cloud"
                className="app-brand-logo"
              />
              <span className="app-brand-name">J&J Practice Cloud</span>
            </a>
          </div>
        </header>

        <div className="page-inner">
          <div className="alert-error">{error || "Patient could not be found."}</div>
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
    <main className="page-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <a href="/dashboard" className="app-brand">
            <img
              src="/logo.jpg"
              alt="J&J Practice Cloud"
              className="app-brand-logo"
            />
            <span className="app-brand-name">J&J Practice Cloud</span>
          </a>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="btn btn-secondary btn-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <div className="page-actions">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/patients/${patient.id}`;
                }}
                className="btn btn-secondary btn-sm"
              >
                ← Patient Profile
              </button>
            </div>

            <h1 className="page-title">
              {fullName} — Appointments
            </h1>

            <p className="page-subtitle">{patient.patient_id}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Add Appointment */}
          <section className="card lg:col-span-1">
            <div className="card-header">
              <h2 className="card-title">New Appointment</h2>
            </div>

            <div className="card-body">
              <form onSubmit={handleAddAppointment}>
                <div className="field">
                  <label htmlFor="appointment_date" className="label">
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
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label htmlFor="start_time" className="label">
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
                      className="input"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="end_time" className="label">
                      End time
                    </label>

                    <input
                      id="end_time"
                      type="time"
                      value={form.end_time}
                      onChange={(e) =>
                        updateField("end_time", e.target.value)
                      }
                      className="input"
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="appointment_type" className="label">
                    Appointment type
                  </label>

                  <select
                    id="appointment_type"
                    value={form.appointment_type}
                    onChange={(e) =>
                      updateField("appointment_type", e.target.value)
                    }
                    className="input"
                  >
                    <option>Consultation</option>
                    <option>Follow-up</option>
                    <option>Procedure</option>
                    <option>Review</option>
                    <option>Emergency</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="reason" className="label">
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
                    className="input"
                  />
                </div>

                <div className="field">
                  <label htmlFor="status" className="label">
                    Status
                  </label>

                  <select
                    id="status"
                    value={form.status}
                    onChange={(e) =>
                      updateField("status", e.target.value)
                    }
                    className="input"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no_show">No Show</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="notes" className="label">
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
                    className="input"
                  />
                </div>

                {error && <div className="alert-error">{error}</div>}

                {success && <div className="alert-success">{success}</div>}

                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary w-full"
                >
                  {saving ? "Saving..." : "Add Appointment"}
                </button>
              </form>
            </div>
          </section>

          {/* Appointment List */}
          <section className="card lg:col-span-2">
            <div className="card-header">
              <h2 className="card-title">Appointment History</h2>
            </div>

            <div className="card-body">
              <p className="text-sm text-[var(--muted)]">
                All appointments for this patient
              </p>

              {appointments.length === 0 ? (
                <div className="empty-state">
                  <p className="font-medium">No appointments yet</p>
                  <p className="mt-1">
                    Use the form to create the first appointment.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="rounded-xl border border-[var(--border)] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">
                            {appointment.appointment_type ||
                              "Appointment"}
                          </p>

                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {appointment.appointment_date}
                            {" · "}
                            {appointment.start_time}
                            {appointment.end_time
                              ? ` – ${appointment.end_time}`
                              : ""}
                          </p>
                        </div>

                        <span className={statusBadgeClass(appointment.status)}>
                          {appointment.status || "scheduled"}
                        </span>
                      </div>

                      {appointment.reason && (
                        <div className="mt-4">
                          <p className="stat-label">Reason</p>
                          <p className="mt-1 text-sm">
                            {appointment.reason}
                          </p>
                        </div>
                      )}

                      {appointment.notes && (
                        <div className="mt-4">
                          <p className="stat-label">Notes</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm">
                            {appointment.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
