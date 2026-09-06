"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Patient = {
  id: string;
  patient_id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  id_number: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  medical_aid_provider: string | null;
  medical_aid_number: string | null;
  medical_aid_plan: string | null;
};

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string | null;
  end_time: string | null;
  appointment_type: string | null;
  reason: string | null;
  status: string | null;
};

type Profile = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function patientFullName(patient: Patient) {
  return [
    patient.first_name,
    patient.middle_name,
    patient.last_name,
  ]
    .filter(Boolean)
    .join(" ");
}

function toNumber(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateRange(
  label: string,
  value: string,
  min: number,
  max: number
) {
  const number = toNumber(value);

  if (number === null) {
    return `${label} must be a valid number.`;
  }

  if (number < min || number > max) {
    return `${label} must be between ${min} and ${max}.`;
  }

  return null;
}

export default function NewConsultationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientId = String(params.id);
  const appointmentId = searchParams.get("appointment_id");

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [consultationDate, setConsultationDate] = useState(today());

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [history, setHistory] = useState("");

  const [temperature, setTemperature] = useState("");
  const [pulse, setPulse] = useState("");
  const [respiratoryRate, setRespiratoryRate] = useState("");
  const [bloodPressureSystolic, setBloodPressureSystolic] = useState("");
  const [bloodPressureDiastolic, setBloodPressureDiastolic] = useState("");
  const [oxygenSaturation, setOxygenSaturation] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  const [examination, setExamination] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [diagnosisCode, setDiagnosisCode] = useState("");

  const [treatment, setTreatment] = useState("");
  const [procedures, setProcedures] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [savedConsultationId, setSavedConsultationId] = useState<string | null>(
    null
  );

  useEffect(() => {
    loadData();
  }, [patientId, appointmentId]);

  async function loadData() {
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.push("/");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("first_name,last_name,display_name")
      .eq("id", user.id)
      .single();

    setProfile(profileData);

    const { data: patientData, error: patientError } = await supabase
      .from("patients")
      .select(
        `
        id,
        patient_id,
        first_name,
        middle_name,
        last_name,
        phone,
        email,
        date_of_birth,
        gender,
        id_number,
        allergies,
        chronic_conditions,
        medical_aid_provider,
        medical_aid_number,
        medical_aid_plan
        `
      )
      .eq("id", patientId)
      .single();

    if (patientError || !patientData) {
      setMessage(patientError?.message || "Patient not found.");
      return;
    }

    setPatient(patientData);

    if (appointmentId) {
      const { data: appointmentData, error: appointmentError } =
        await supabase
          .from("appointments")
          .select(
            `
            id,
            appointment_date,
            start_time,
            end_time,
            appointment_type,
            reason,
            status
            `
          )
          .eq("id", appointmentId)
          .eq("patient_id", patientId)
          .single();

      if (!appointmentError && appointmentData) {
        setAppointment(appointmentData);

        if (appointmentData.appointment_date) {
          setConsultationDate(appointmentData.appointment_date);
        }

        if (appointmentData.reason) {
          setChiefComplaint(appointmentData.reason);
        }
      }
    }
  }

  const patientName = useMemo(() => {
    if (!patient) return "Patient";
    return patientFullName(patient) || "Patient";
  }, [patient]);

  const providerName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "Current Provider";

  function validateForm() {
    if (!consultationDate) {
      return "Consultation date is required.";
    }

    if (
      !chiefComplaint.trim() &&
      !diagnosis.trim() &&
      !clinicalNotes.trim()
    ) {
      return "Please enter at least a chief complaint, diagnosis, or clinical notes.";
    }

    const validations = [
      ["Temperature", temperature, 30, 45],
      ["Pulse", pulse, 20, 250],
      ["Respiratory rate", respiratoryRate, 5, 80],
      ["Systolic BP", bloodPressureSystolic, 50, 300],
      ["Diastolic BP", bloodPressureDiastolic, 20, 200],
      ["Oxygen saturation", oxygenSaturation, 50, 100],
      ["Weight", weight, 0.5, 500],
      ["Height", height, 20, 250],
    ] as const;

    for (const [label, value, min, max] of validations) {
      if (value.trim()) {
        const error = validateRange(label, value, min, max);
        if (error) return error;
      }
    }

    if (followUpDate && followUpDate < consultationDate) {
      return "Follow-up date cannot be before the consultation date.";
    }

    return null;
  }

  async function saveConsultation(
    event: React.FormEvent<HTMLFormElement>,
    nextAction: "history" | "prescription" | "sick-note" = "history"
  ) {
    event.preventDefault();

    if (saving) return;

    const validationError = validateForm();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("practice_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData?.practice_id) {
        throw new Error("Unable to determine the practice.");
      }

      const { data: inserted, error: insertError } = await supabase
        .from("consultations")
        .insert({
          practice_id: profileData.practice_id,
          patient_id: patientId,
          appointment_id: appointmentId || null,
          provider_id: user.id,
          consultation_date: consultationDate,
          chief_complaint: chiefComplaint.trim() || null,
          history_of_present_illness: history.trim() || null,
          temperature: toNumber(temperature),
          pulse: toNumber(pulse),
          respiratory_rate: toNumber(respiratoryRate),
          blood_pressure_systolic: toNumber(bloodPressureSystolic),
          blood_pressure_diastolic: toNumber(bloodPressureDiastolic),
          oxygen_saturation: toNumber(oxygenSaturation),
          weight: toNumber(weight),
          height: toNumber(height),
          examination: examination.trim() || null,
          diagnosis: diagnosis.trim() || null,
          diagnosis_code: diagnosisCode.trim() || null,
          treatment: treatment.trim() || null,
          procedures: procedures.trim() || null,
          clinical_notes: clinicalNotes.trim() || null,
          follow_up_notes: followUpNotes.trim() || null,
          follow_up_date: followUpDate || null,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        throw new Error(insertError?.message || "Failed to save consultation.");
      }

      if (appointmentId) {
        await supabase
          .from("appointments")
          .update({ status: "completed" })
          .eq("id", appointmentId)
          .eq("patient_id", patientId);
      }

      setSavedConsultationId(inserted.id);

      if (nextAction === "prescription") {
        router.push(
          `/patients/${patientId}/prescriptions/new?consultation_id=${inserted.id}`
        );
        return;
      }

      if (nextAction === "sick-note") {
        router.push(
          `/sick-notes?patient_id=${patientId}&consultation_id=${inserted.id}`
        );
        return;
      }

      router.push(`/patients/${patientId}/consultations`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to save consultation."
      );
    } finally {
      setSaving(false);
    }
  }

  function printConsultation() {
    window.print();
  }

  if (!patient) {
    return (
      <main style={{ padding: 24 }}>
        <h1>New Consultation</h1>
        <p>{message || "Loading patient..."}</p>
      </main>
    );
  }

  return (
    <>
      <main
        className="consultation-page"
        style={{
          padding: 24,
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ marginBottom: 4 }}>New Consultation</h1>
            <p style={{ margin: 0, color: "#666" }}>
              Clinical consultation for {patientName}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(`/patients/${patientId}/consultations`)
            }
          >
            Back to History
          </button>
        </div>

        <section
          style={{
            padding: 18,
            marginBottom: 20,
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <div>
              <strong>{patientName}</strong>
              <div>Patient ID: {patient.patient_id}</div>
              <div>Phone: {patient.phone || "Not provided"}</div>
              <div>Email: {patient.email || "Not provided"}</div>
            </div>

            <div>
              <strong>Provider</strong>
              <div>{providerName}</div>
            </div>

            <div>
              <strong>Consultation Date</strong>
              <input
                type="date"
                value={consultationDate}
                onChange={(e) => setConsultationDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                }}
              />
            </div>
          </div>

          {(patient.allergies || patient.chronic_conditions) && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                border: "1px solid #f59e0b",
                borderRadius: 8,
                background: "#fffbeb",
              }}
            >
              <strong>Clinical Alerts</strong>

              {patient.allergies && (
                <div style={{ marginTop: 8 }}>
                  <strong>Allergies:</strong> {patient.allergies}
                </div>
              )}

              {patient.chronic_conditions && (
                <div style={{ marginTop: 6 }}>
                  <strong>Chronic Conditions:</strong>{" "}
                  {patient.chronic_conditions}
                </div>
              )}
            </div>
          )}

          {patient.medical_aid_provider && (
            <div style={{ marginTop: 14, color: "#555" }}>
              <strong>Medical Aid:</strong>{" "}
              {patient.medical_aid_provider}
              {patient.medical_aid_number
                ? ` — ${patient.medical_aid_number}`
                : ""}
              {patient.medical_aid_plan
                ? ` — ${patient.medical_aid_plan}`
                : ""}
            </div>
          )}

          {appointment && (
            <div style={{ marginTop: 16 }}>
              <strong>Linked Appointment</strong>
              <div>
                {appointment.appointment_date}{" "}
                {appointment.start_time?.slice(0, 5)} –{" "}
                {appointment.end_time?.slice(0, 5)}
              </div>
              <div>
                {appointment.appointment_type || "Appointment"}
                {appointment.reason ? ` — ${appointment.reason}` : ""}
              </div>
            </div>
          )}
        </section>

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
          onSubmit={(event) => saveConsultation(event, "history")}
          style={{ display: "grid", gap: 20 }}
        >
          <section className="card">
            <h2>Presenting Complaint</h2>

            <label>
              Chief Complaint
              <textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                rows={3}
                placeholder="What brought the patient to the practice?"
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>

            <label style={{ display: "block", marginTop: 16 }}>
              History of Present Illness
              <textarea
                value={history}
                onChange={(e) => setHistory(e.target.value)}
                rows={5}
                placeholder="Relevant history, symptoms, duration and progression..."
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>
          </section>

          <section className="card">
            <h2>Vital Signs</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
              }}
            >
              <label>
                Temperature (°C)
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="e.g. 36.8"
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                />
              </label>

              <label>
                Pulse (bpm)
                <input
                  type="number"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                  placeholder="e.g. 72"
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                />
              </label>

              <label>
                Respiratory Rate (/min)
                <input
                  type="number"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(e.target.value)}
                  placeholder="e.g. 18"
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                />
              </label>

              <label>
                Systolic BP
                <input
                  type="number"
                  value={bloodPressureSystolic}
                  onChange={(e) =>
                    setBloodPressureSystolic(e.target.value)
                  }
                  placeholder="e.g. 120"
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                />
              </label>

              <label>
                Diastolic BP
                <input
                  type="number"
                  value={bloodPressureDiastolic}
                  onChange={(e) =>
                    setBloodPressureDiastolic(e.target.value)
                  }
                  placeholder="e.g. 80"
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                />
              </label>

              <label>
                Oxygen Saturation (%)
                <input
                  type="number"
                  step="0.1"
                  value={oxygenSaturation}
                  onChange={(e) => setOxygenSaturation(e.target.value)}
                  placeholder="e.g. 98"
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                />
              </label>

              <label>
                Weight (kg)
                <input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g. 70"
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                />
              </label>

              <label>
                Height (cm)
                <input
                  type="number"
                  step="0.1"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="e.g. 170"
                  style={{ width: "100%", padding: 10, marginTop: 6 }}
                />
              </label>
            </div>
          </section>

          <section className="card">
            <h2>Clinical Assessment</h2>

            <label>
              Examination
              <textarea
                value={examination}
                onChange={(e) => setExamination(e.target.value)}
                rows={5}
                placeholder="Physical examination findings..."
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>

            <label style={{ display: "block", marginTop: 16 }}>
              Diagnosis
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                rows={4}
                placeholder="Diagnosis / clinical impression..."
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>

            <label style={{ display: "block", marginTop: 16 }}>
              Diagnosis Code
              <input
                type="text"
                value={diagnosisCode}
                onChange={(e) => setDiagnosisCode(e.target.value)}
                placeholder="Optional ICD-10 code"
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>
          </section>

          <section className="card">
            <h2>Treatment & Procedures</h2>

            <label>
              Treatment
              <textarea
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                rows={4}
                placeholder="Treatment provided or recommended..."
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>

            <label style={{ display: "block", marginTop: 16 }}>
              Procedures
              <textarea
                value={procedures}
                onChange={(e) => setProcedures(e.target.value)}
                rows={4}
                placeholder="Procedures performed..."
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>

            <label style={{ display: "block", marginTop: 16 }}>
              Clinical Notes
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={6}
                placeholder="Additional clinical notes..."
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>
          </section>

          <section className="card">
            <h2>Follow-up</h2>

            <label>
              Follow-up Date
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>

            <label style={{ display: "block", marginTop: 16 }}>
              Follow-up Notes
              <textarea
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                rows={4}
                placeholder="Instructions for follow-up..."
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>
          </section>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() =>
                router.push(`/patients/${patientId}/consultations`)
              }
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={printConsultation}
              disabled={saving}
            >
              🖨 Print
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={(event) =>
                saveConsultation(
                  event as unknown as React.FormEvent<HTMLFormElement>,
                  "prescription"
                )
              }
            >
              Save & Create Prescription
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={(event) =>
                saveConsultation(
                  event as unknown as React.FormEvent<HTMLFormElement>,
                  "sick-note"
                )
              }
            >
              Save & Create Sick Note
            </button>

            <button type="submit" disabled={saving}>
              {saving ? "Saving Consultation..." : "Save Consultation"}
            </button>
          </div>
        </form>
      </main>

      <section className="consultation-print">
        <div className="print-header">
          <h1>J&J PRACTICE MEDICAL CENTRE</h1>
          <p>Clinical Consultation Record</p>
        </div>

        <hr />

        <h2>Patient Information</h2>
        <div className="print-grid">
          <div>
            <strong>Patient:</strong> {patientName}
          </div>
          <div>
            <strong>Patient ID:</strong> {patient.patient_id}
          </div>
          <div>
            <strong>Date of Birth:</strong>{" "}
            {patient.date_of_birth || "Not provided"}
          </div>
          <div>
            <strong>Gender:</strong> {patient.gender || "Not provided"}
          </div>
          <div>
            <strong>ID Number:</strong>{" "}
            {patient.id_number || "Not provided"}
          </div>
          <div>
            <strong>Phone:</strong> {patient.phone || "Not provided"}
          </div>
        </div>

        <h2>Consultation</h2>
        <div className="print-grid">
          <div>
            <strong>Date:</strong> {consultationDate}
          </div>
          <div>
            <strong>Provider:</strong> {providerName}
          </div>
          <div>
            <strong>Appointment:</strong>{" "}
            {appointment?.appointment_type || "Walk-in / Direct Consultation"}
          </div>
        </div>

        <h2>Clinical Record</h2>

        <p>
          <strong>Chief Complaint:</strong>{" "}
          {chiefComplaint || "Not recorded"}
        </p>

        <p>
          <strong>History of Present Illness:</strong>{" "}
          {history || "Not recorded"}
        </p>

        <p>
          <strong>Examination:</strong>{" "}
          {examination || "Not recorded"}
        </p>

        <p>
          <strong>Diagnosis:</strong> {diagnosis || "Not recorded"}
        </p>

        <p>
          <strong>Diagnosis Code:</strong>{" "}
          {diagnosisCode || "Not recorded"}
        </p>

        <h2>Vital Signs</h2>

        <table>
          <thead>
            <tr>
              <th>Temperature</th>
              <th>Pulse</th>
              <th>Respiratory Rate</th>
              <th>Blood Pressure</th>
              <th>Oxygen</th>
              <th>Weight</th>
              <th>Height</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{temperature || "—"} °C</td>
              <td>{pulse || "—"} bpm</td>
              <td>{respiratoryRate || "—"} /min</td>
              <td>
                {bloodPressureSystolic || "—"}/
                {bloodPressureDiastolic || "—"}
              </td>
              <td>{oxygenSaturation || "—"}%</td>
              <td>{weight || "—"} kg</td>
              <td>{height || "—"} cm</td>
            </tr>
          </tbody>
        </table>

        <h2>Treatment & Procedures</h2>

        <p>
          <strong>Treatment:</strong> {treatment || "Not recorded"}
        </p>

        <p>
          <strong>Procedures:</strong> {procedures || "Not recorded"}
        </p>

        <p>
          <strong>Clinical Notes:</strong>{" "}
          {clinicalNotes || "Not recorded"}
        </p>

        <h2>Follow-up</h2>

        <p>
          <strong>Follow-up Date:</strong>{" "}
          {followUpDate || "Not scheduled"}
        </p>

        <p>
          <strong>Follow-up Notes:</strong>{" "}
          {followUpNotes || "Not recorded"}
        </p>

        <div className="signature-area">
          <div>
            ______________________________
            <br />
            Practitioner Signature
          </div>

          <div>
            ______________________________
            <br />
            Date
          </div>
        </div>
      </section>

      <style jsx global>{`
        .consultation-print {
          display: none;
        }

        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }

          body {
            background: white !important;
          }

          .consultation-page {
            display: none !important;
          }

          .consultation-print {
            display: block !important;
            font-family: Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.45;
            color: #111;
          }

          .print-header {
            text-align: center;
          }

          .print-header h1 {
            margin: 0;
            font-size: 20pt;
          }

          .print-header p {
            margin: 4px 0 10px;
            font-size: 12pt;
          }

          .consultation-print h2 {
            margin: 18px 0 8px;
            font-size: 13pt;
            border-bottom: 1px solid #999;
            padding-bottom: 4px;
          }

          .print-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 7px 20px;
          }

          .consultation-print p {
            margin: 8px 0;
          }

          .consultation-print table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }

          .consultation-print th,
          .consultation-print td {
            border: 1px solid #999;
            padding: 6px;
            text-align: left;
          }

          .signature-area {
            display: flex;
            justify-content: space-between;
            margin-top: 45px;
          }
        }
      `}</style>
    </>
  );
}
