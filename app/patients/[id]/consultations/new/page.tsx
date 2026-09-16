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
              <h1 className="page-title">New Consultation</h1>
            </div>
          </div>
          <div className="empty-state">
            {message || "Loading patient..."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="page-shell consultation-page">
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
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  router.push(`/patients/${patientId}/consultations`)
                }
              >
                Back to History
              </button>
            </div>
          </div>
        </header>

        <div className="page-inner">
          <div className="page-header">
            <div>
              <h1 className="page-title">New Consultation</h1>
              <p className="page-subtitle">
                Clinical consultation for {patientName}
              </p>
            </div>
          </div>

          <section className="card">
            <div className="card-body">
              <div className="grid gap-6 md:grid-cols-3">
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

                <div className="field">
                  <label className="label" htmlFor="consultation-date">
                    Consultation Date
                  </label>
                  <input
                    id="consultation-date"
                    type="date"
                    className="input"
                    value={consultationDate}
                    onChange={(e) => setConsultationDate(e.target.value)}
                  />
                </div>
              </div>

              {(patient.allergies || patient.chronic_conditions) && (
                <div className="alert-info mt-4">
                  <strong>Clinical Alerts</strong>

                  {patient.allergies && (
                    <div className="mt-2">
                      <strong>Allergies:</strong> {patient.allergies}
                    </div>
                  )}

                  {patient.chronic_conditions && (
                    <div className="mt-1">
                      <strong>Chronic Conditions:</strong>{" "}
                      {patient.chronic_conditions}
                    </div>
                  )}
                </div>
              )}

              {patient.medical_aid_provider && (
                <div className="mt-4 text-sm text-slate-600">
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
                <div className="mt-4">
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
            </div>
          </section>

          {message && <div className="alert-error">{message}</div>}

          <form
            onSubmit={(event) => saveConsultation(event, "history")}
            className="space-y-5"
          >
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Presenting Complaint</h2>
              </div>
              <div className="card-body">
                <label className="field">
                  <span className="label">Chief Complaint</span>
                  <textarea
                    className="input"
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    rows={3}
                    placeholder="What brought the patient to the practice?"
                  />
                </label>

                <label className="field">
                  <span className="label">History of Present Illness</span>
                  <textarea
                    className="input"
                    value={history}
                    onChange={(e) => setHistory(e.target.value)}
                    rows={5}
                    placeholder="Relevant history, symptoms, duration and progression..."
                  />
                </label>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Vital Signs</h2>
              </div>
              <div className="card-body">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="field">
                    <span className="label">Temperature (°C)</span>
                    <input
                      type="number"
                      className="input"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      placeholder="e.g. 36.8"
                    />
                  </label>

                  <label className="field">
                    <span className="label">Pulse (bpm)</span>
                    <input
                      type="number"
                      className="input"
                      value={pulse}
                      onChange={(e) => setPulse(e.target.value)}
                      placeholder="e.g. 72"
                    />
                  </label>

                  <label className="field">
                    <span className="label">Respiratory Rate (/min)</span>
                    <input
                      type="number"
                      className="input"
                      value={respiratoryRate}
                      onChange={(e) => setRespiratoryRate(e.target.value)}
                      placeholder="e.g. 18"
                    />
                  </label>

                  <label className="field">
                    <span className="label">Systolic BP</span>
                    <input
                      type="number"
                      className="input"
                      value={bloodPressureSystolic}
                      onChange={(e) =>
                        setBloodPressureSystolic(e.target.value)
                      }
                      placeholder="e.g. 120"
                    />
                  </label>

                  <label className="field">
                    <span className="label">Diastolic BP</span>
                    <input
                      type="number"
                      className="input"
                      value={bloodPressureDiastolic}
                      onChange={(e) =>
                        setBloodPressureDiastolic(e.target.value)
                      }
                      placeholder="e.g. 80"
                    />
                  </label>

                  <label className="field">
                    <span className="label">Oxygen Saturation (%)</span>
                    <input
                      type="number"
                      className="input"
                      step="0.1"
                      value={oxygenSaturation}
                      onChange={(e) => setOxygenSaturation(e.target.value)}
                      placeholder="e.g. 98"
                    />
                  </label>

                  <label className="field">
                    <span className="label">Weight (kg)</span>
                    <input
                      type="number"
                      className="input"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="e.g. 70"
                    />
                  </label>

                  <label className="field">
                    <span className="label">Height (cm)</span>
                    <input
                      type="number"
                      className="input"
                      step="0.1"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="e.g. 170"
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Clinical Assessment</h2>
              </div>
              <div className="card-body">
                <label className="field">
                  <span className="label">Examination</span>
                  <textarea
                    className="input"
                    value={examination}
                    onChange={(e) => setExamination(e.target.value)}
                    rows={5}
                    placeholder="Physical examination findings..."
                  />
                </label>

                <label className="field">
                  <span className="label">Diagnosis</span>
                  <textarea
                    className="input"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    rows={4}
                    placeholder="Diagnosis / clinical impression..."
                  />
                </label>

                <label className="field">
                  <span className="label">Diagnosis Code</span>
                  <input
                    type="text"
                    className="input"
                    value={diagnosisCode}
                    onChange={(e) => setDiagnosisCode(e.target.value)}
                    placeholder="Optional ICD-10 code"
                  />
                </label>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Treatment & Procedures</h2>
              </div>
              <div className="card-body">
                <label className="field">
                  <span className="label">Treatment</span>
                  <textarea
                    className="input"
                    value={treatment}
                    onChange={(e) => setTreatment(e.target.value)}
                    rows={4}
                    placeholder="Treatment provided or recommended..."
                  />
                </label>

                <label className="field">
                  <span className="label">Procedures</span>
                  <textarea
                    className="input"
                    value={procedures}
                    onChange={(e) => setProcedures(e.target.value)}
                    rows={4}
                    placeholder="Procedures performed..."
                  />
                </label>

                <label className="field">
                  <span className="label">Clinical Notes</span>
                  <textarea
                    className="input"
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    rows={6}
                    placeholder="Additional clinical notes..."
                  />
                </label>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Follow-up</h2>
              </div>
              <div className="card-body">
                <label className="field">
                  <span className="label">Follow-up Date</span>
                  <input
                    type="date"
                    className="input"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </label>

                <label className="field">
                  <span className="label">Follow-up Notes</span>
                  <textarea
                    className="input"
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    rows={4}
                    placeholder="Instructions for follow-up..."
                  />
                </label>
              </div>
            </section>

            <div className="page-actions justify-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  router.push(`/patients/${patientId}/consultations`)
                }
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={printConsultation}
                disabled={saving}
              >
                🖨 Print
              </button>

              <button
                type="button"
                className="btn btn-secondary"
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
                className="btn btn-secondary"
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

              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving Consultation..." : "Save Consultation"}
              </button>
            </div>
          </form>
        </div>
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
