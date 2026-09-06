"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
      <main style={{ padding: 24 }}>
        <h1>New Appointment</h1>
        <p>Loading patients...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h1>New Appointment</h1>
          <p style={{ color: "#666" }}>
            Create an appointment for an existing patient.
          </p>
        </div>

        <button onClick={() => router.push("/appointments")}>
          Back to Appointments
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: 12,
            marginBottom: 20,
            borderRadius: 8,
            background: "#f1f5f9",
          }}
        >
          {message}
        </div>
      )}

      <form
        onSubmit={saveAppointment}
        style={{
          display: "grid",
          gap: 18,
        }}
      >
        <section
          style={{
            padding: 20,
            border: "1px solid #ddd",
            borderRadius: 10,
          }}
        >
          <h2>Patient</h2>

          <label>
            Patient *
            <br />
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              required
              style={{
                width: "100%",
                padding: 10,
                marginTop: 6,
              }}
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
          </label>

          {selectedPatient && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 8,
                background: "#f8fafc",
              }}
            >
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
        </section>

        <section
          style={{
            padding: 20,
            border: "1px solid #ddd",
            borderRadius: 10,
          }}
        >
          <h2>Appointment Details</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            <label>
              Date *
              <br />
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                }}
              />
            </label>

            <label>
              Start Time *
              <br />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                }}
              />
            </label>

            <label>
              End Time *
              <br />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                }}
              />
            </label>

            <label>
              Appointment Type
              <br />
              <select
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                }}
              >
                {appointmentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Status
              <br />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                }}
              >
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            <label>
              Reason
              <br />
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for appointment"
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                }}
              />
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            <label>
              Notes
              <br />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="Additional appointment notes"
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                }}
              />
            </label>
          </div>
        </section>

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/appointments")}
          >
            Cancel
          </button>

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create Appointment"}
          </button>
        </div>
      </form>
    </main>
  );
}
