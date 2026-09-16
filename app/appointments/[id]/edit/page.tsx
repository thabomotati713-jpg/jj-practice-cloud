"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Appointment = {
  id: string;
  patient_id: string;
  provider_id: string;
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

export default function EditAppointmentPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = params.id as string;

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    appointment_date: "",
    start_time: "",
    end_time: "",
    appointment_type: "",
    reason: "",
    status: "scheduled",
    notes: "",
  });

  useEffect(() => {
    loadAppointment();
  }, [appointmentId]);

  async function loadAppointment() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.practice_id) {
      setError("Unable to determine practice.");
      setLoading(false);
      return;
    }

    const { data, error: appointmentError } = await supabase
      .from("appointments")
      .select(
        "id, patient_id, provider_id, appointment_date, start_time, end_time, appointment_type, reason, status, notes"
      )
      .eq("id", appointmentId)
      .eq("practice_id", profile.practice_id)
      .single();

    if (appointmentError || !data) {
      setError("Appointment not found.");
      setLoading(false);
      return;
    }

    const appointmentData = data as Appointment;

    const { data: patientData } = await supabase
      .from("patients")
      .select("id, patient_id, first_name, middle_name, last_name")
      .eq("id", appointmentData.patient_id)
      .eq("practice_id", profile.practice_id)
      .single();

    setAppointment(appointmentData);
    setPatient(patientData as Patient | null);

    setForm({
      appointment_date: appointmentData.appointment_date || "",
      start_time: appointmentData.start_time || "",
      end_time: appointmentData.end_time || "",
      appointment_type: appointmentData.appointment_type || "",
      reason: appointmentData.reason || "",
      status: appointmentData.status || "scheduled",
      notes: appointmentData.notes || "",
    });

    setLoading(false);
  }

  function updateField(field: string, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.practice_id) {
      setError("Unable to determine practice.");
      setSaving(false);
      return;
    }

    if (
      form.start_time &&
      form.end_time &&
      form.end_time <= form.start_time
    ) {
      setError(
        "End time must be after the start time. Appointments cannot end before they begin."
      );
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        appointment_date: form.appointment_date,
        start_time: form.start_time,
        end_time: form.end_time || null,
        appointment_type: form.appointment_type || null,
        reason: form.reason || null,
        status: form.status || "scheduled",
        notes: form.notes || null,
      })
      .eq("id", appointmentId)
      .eq("practice_id", profile.practice_id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setMessage("Appointment updated successfully.");
    setSaving(false);

    setTimeout(() => {
      router.push("/appointments");
    }, 800);
  }

  if (loading) {
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
          <div className="page-header">
            <div>
              <h1 className="page-title">Edit Appointment</h1>
            </div>
          </div>

          <div className="empty-state">Loading appointment...</div>
        </div>
      </main>
    );
  }

  if (!appointment) {
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
          <div className="page-header">
            <div>
              <h1 className="page-title">Edit Appointment</h1>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              {error && <div className="alert-error">{error}</div>}

              {!error && <div className="alert-error">Appointment not found.</div>}

              <button
                onClick={() => router.push("/appointments")}
                className="btn btn-secondary btn-sm"
              >
                Back to Appointments
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

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

          <div className="page-actions">
            <button
              onClick={() => router.push("/appointments")}
              className="btn btn-secondary btn-sm"
            >
              ← Back to Appointments
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Edit Appointment</h1>

            {patient && (
              <p className="page-subtitle">
                {patient.patient_id} — {patient.first_name}{" "}
                {patient.middle_name ? `${patient.middle_name} ` : ""}
                {patient.last_name}
              </p>
            )}
          </div>
        </div>

        {message && <div className="alert-success">{message}</div>}

        {error && <div className="alert-error">{error}</div>}

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Appointment Details</h2>
          </div>

          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="stat-grid">
                <div className="field">
                  <label className="label" htmlFor="appointment-date">
                    Appointment Date
                  </label>
                  <input
                    id="appointment-date"
                    type="date"
                    value={form.appointment_date}
                    onChange={(e) =>
                      updateField("appointment_date", e.target.value)
                    }
                    required
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="appointment-type">
                    Appointment Type
                  </label>
                  <select
                    id="appointment-type"
                    value={form.appointment_type}
                    onChange={(e) =>
                      updateField("appointment_type", e.target.value)
                    }
                    className="input"
                  >
                    <option value="">Select type</option>
                    <option value="Consultation">Consultation</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Procedure">Procedure</option>
                    <option value="Review">Review</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="field">
                  <label className="label" htmlFor="start-time">
                    Start Time
                  </label>
                  <input
                    id="start-time"
                    type="time"
                    value={form.start_time}
                    onChange={(e) => updateField("start_time", e.target.value)}
                    required
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="end-time">
                    End Time
                  </label>
                  <input
                    id="end-time"
                    type="time"
                    value={form.end_time}
                    onChange={(e) => updateField("end_time", e.target.value)}
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="status">
                    Status
                  </label>
                  <select
                    id="status"
                    value={form.status}
                    onChange={(e) => updateField("status", e.target.value)}
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
                  <label className="label" htmlFor="reason">
                    Reason
                  </label>
                  <input
                    id="reason"
                    type="text"
                    value={form.reason}
                    onChange={(e) => updateField("reason", e.target.value)}
                    className="input"
                    placeholder="Reason for appointment"
                  />
                </div>
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  rows={5}
                  className="input"
                  placeholder="Appointment notes"
                />
              </div>

              <div
                className="page-actions"
                style={{ justifyContent: "flex-end", marginTop: 20 }}
              >
                <button
                  type="button"
                  onClick={() => router.push("/appointments")}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
