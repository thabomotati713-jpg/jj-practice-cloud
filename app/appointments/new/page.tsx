"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  fetchMySpecialty,
  getSpecialty,
  type SpecialtyConfig,
} from "@/lib/specialties";

type Patient = {
  id: string;
  patient_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  phone: string | null;
  email: string | null;
};

const appointmentTypes = [
  "Consultation",
  "Follow-up",
  "Procedure",
  "Review",
  "Medical Examination",
  "Emergency",
  "Other",
];

const statuses = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

export default function NewAppointmentPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [appointmentType, setAppointmentType] = useState("Consultation");
  const [status, setStatus] = useState("scheduled");
  const [reason, setReason] = useState("");
  const [specialtyConfig, setSpecialtyConfig] = useState<SpecialtyConfig>(
    getSpecialty("general")
  );

  useEffect(() => {
    fetchMySpecialty(supabase, supabase).then(setSpecialtyConfig);
  }, []);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    setLoading(true);

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
      setMessage("Unable to determine your practice.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("patients")
      .select(
        "id, patient_id, first_name, middle_name, last_name, phone, email"
      )
      .eq("practice_id", profile.practice_id)
      .order("last_name", { ascending: true });

    if (error) {
      setMessage(error.message);
    } else {
      setPatients(data || []);
    }

    setLoading(false);
  }

  const selectedPatient = patients.find(
    (patient) => patient.id === patientId
  );

  async function saveAppointment(e: React.FormEvent) {
    e.preventDefault();

    setMessage("");

    if (!patientId) {
      setMessage("Please select a patient.");
      return;
    }

    if (!appointmentDate) {
      setMessage("Please select an appointment date.");
      return;
    }

    if (!startTime) {
      setMessage("Please enter a start time.");
      return;
    }

    if (!endTime) {
      setMessage("Please enter an end time.");
      return;
    }

    if (endTime <= startTime) {
      setMessage("End time must be later than start time.");
      return;
    }

    const selectedDate = new Date(`${appointmentDate}T00:00:00`);

    if (Number.isNaN(selectedDate.getTime())) {
      setMessage("Please enter a valid appointment date.");
      return;
    }

    setSaving(true);

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
      setMessage("Unable to determine your practice.");
      setSaving(false);
      return;
    }

    if (startTime && endTime && endTime <= startTime) {
      setMessage(
        "End time must be after the start time. Appointments cannot end before they begin."
      );
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("appointments").insert({
      practice_id: profile.practice_id,
      patient_id: patientId,
      provider_id: user.id,
      appointment_date: appointmentDate,
      start_time: startTime,
      end_time: endTime,
      appointment_type: appointmentType,
      reason: reason.trim() || null,
      status,
      notes: notes.trim() || null,
      reminder_sent: false,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage("Appointment created successfully.");

    setPatientId("");
    setAppointmentDate("");
    setStartTime("");
    setEndTime("");
    setAppointmentType("Consultation");
    setStatus("scheduled");
    setReason("");
    setNotes("");

    setSaving(false);
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
              <h1 className="page-title">New Appointment</h1>
            </div>
          </div>

          <div className="empty-state">Loading patients...</div>
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
              Back to Appointments
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">New Appointment</h1>
            <p className="page-subtitle">
              Create an appointment for an existing patient.
            </p>
          </div>
        </div>

        {message && (
          <div
            className={
              message.includes("successfully")
                ? "alert-success"
                : "alert-error"
            }
          >
            {message}
          </div>
        )}

        <form onSubmit={saveAppointment}>
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Patient</h2>
            </div>

            <div className="card-body">
              <div className="field">
                <label className="label" htmlFor="patient">
                  Patient *
                </label>
                <select
                  id="patient"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  required
                  className="input"
                >
                  <option value="">Select patient</option>

                  {patients.map((patient) => {
                    const name =
                      `${patient.first_name} ${patient.middle_name || ""} ${patient.last_name}`
                        .replace(/\s+/g, " ")
                        .trim();

                    return (
                      <option key={patient.id} value={patient.id}>
                        {patient.patient_id} — {name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedPatient && (
                <div className="alert-info">
                  <strong>
                    {selectedPatient.first_name}{" "}
                    {selectedPatient.middle_name || ""}{" "}
                    {selectedPatient.last_name}
                  </strong>

                  <div>Patient ID: {selectedPatient.patient_id}</div>
                  <div>Phone: {selectedPatient.phone || "Not provided"}</div>
                  <div>Email: {selectedPatient.email || "Not provided"}</div>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Appointment Details</h2>
            </div>

            <div className="card-body">
              <div className="stat-grid">
                <div className="field">
                  <label className="label" htmlFor="appointment-date">
                    Date *
                  </label>
                  <input
                    id="appointment-date"
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    required
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="start-time">
                    Start Time *
                  </label>
                  <input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="end-time">
                    End Time *
                  </label>
                  <input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
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
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value)}
                    className="input"
                  >
                    {appointmentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="label" htmlFor="appointment-status">
                    Status
                  </label>
                  <select
                    id="appointment-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="input"
                  >
                    {statuses.map((item) => (
                      <option key={item} value={item}>
                        {item.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="reason">
                  Reason
                </label>
                <input
                  id="reason"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`e.g. ${specialtyConfig.appointmentReasons[0]}`}
                  className="input"
                  list="reason-presets"
                />
                <datalist id="reason-presets">
                  {specialtyConfig.appointmentReasons.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="Additional appointment notes"
                  className="input"
                />
              </div>
            </div>
          </section>

          <div className="page-actions" style={{ justifyContent: "flex-end" }}>
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
              {saving ? "Saving..." : "Create Appointment"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
