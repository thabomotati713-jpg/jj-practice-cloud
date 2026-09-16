"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CommunicationBar from "@/components/CommunicationBar";
import { logAudit } from "@/lib/audit";

type Patient = {
  id: string;
  patient_id: string;
  title: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  id_number: string | null;
  passport_number: string | null;
  phone: string | null;
  alternative_phone: string | null;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  occupation: string | null;
  marital_status: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  medical_aid_provider: string | null;
  medical_aid_number: string | null;
  medical_aid_plan: string | null;
  medical_aid_dependent_code: string | null;
  medical_aid_main_member: string | null;
  blood_type: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  status: string | null;
  notes: string | null;
};

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  appointment_type: string | null;
  reason: string | null;
  status: string | null;
};

type Consultation = {
  id: string;
  consultation_date: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment: string | null;
};

type Prescription = {
  id: string;
  prescription_number: string;
  prescription_date: string;
  status: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total: number;
  balance: number;
  status: string | null;
};

type Claim = {
  id: string;
  claim_number: string;
  claim_date: string;
  claimed_amount: number;
  status: string | null;
};

type SickNote = {
  id: string;
  note_number: string;
  issue_date: string;
  start_date: string;
  end_date: string;
};

type Document = {
  id: string;
  document_name?: string | null;
  file_name?: string | null;
  document_type?: string | null;
  created_at?: string | null;
};

export default function PatientFilePage() {
  const params = useParams();
  const router = useRouter();

  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [sickNotes, setSickNotes] = useState<SickNote[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPatientFile();
  }, [patientId]);

  async function loadPatientFile() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("practice_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.practice_id) {
        throw new Error("Unable to determine practice.");
      }

      const practiceId = profile.practice_id;

      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .eq("practice_id", practiceId)
        .single();

      if (patientError) {
        throw new Error(patientError.message);
      }

      setPatient(patientData);

      // POPIA: patient record access is always logged.
      logAudit(
        "view",
        "patient",
        patientId,
        "Patient record opened"
      );

      const [
        appointmentsResult,
        consultationsResult,
        prescriptionsResult,
        invoicesResult,
        claimsResult,
        sickNotesResult,
        documentsResult,
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, appointment_date, start_time, appointment_type, reason, status"
          )
          .eq("patient_id", patientId)
          .eq("practice_id", practiceId)
          .order("appointment_date", { ascending: false })
          .limit(5),

        supabase
          .from("consultations")
          .select(
            "id, consultation_date, chief_complaint, diagnosis, treatment"
          )
          .eq("patient_id", patientId)
          .eq("practice_id", practiceId)
          .order("consultation_date", { ascending: false })
          .limit(5),

        supabase
          .from("prescriptions")
          .select("id, prescription_number, prescription_date, status")
          .eq("patient_id", patientId)
          .eq("practice_id", practiceId)
          .order("prescription_date", { ascending: false })
          .limit(5),

        supabase
          .from("invoices")
          .select("id, invoice_number, invoice_date, total, balance, status")
          .eq("patient_id", patientId)
          .eq("practice_id", practiceId)
          .order("invoice_date", { ascending: false })
          .limit(5),

        supabase
          .from("medical_aid_claims")
          .select(
            "id, claim_number, claim_date, claimed_amount, status"
          )
          .eq("patient_id", patientId)
          .eq("practice_id", practiceId)
          .order("claim_date", { ascending: false })
          .limit(5),

        supabase
          .from("sick_notes")
          .select("id, note_number, issue_date, start_date, end_date")
          .eq("patient_id", patientId)
          .eq("practice_id", practiceId)
          .order("issue_date", { ascending: false })
          .limit(5),

        supabase
          .from("patient_documents")
          .select("*")
          .eq("patient_id", patientId)
          .eq("practice_id", practiceId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (appointmentsResult.error) {
        console.warn("Appointments:", appointmentsResult.error.message);
      }

      if (consultationsResult.error) {
        console.warn("Consultations:", consultationsResult.error.message);
      }

      if (prescriptionsResult.error) {
        console.warn("Prescriptions:", prescriptionsResult.error.message);
      }

      if (invoicesResult.error) {
        console.warn("Invoices:", invoicesResult.error.message);
      }

      if (claimsResult.error) {
        console.warn("Claims:", claimsResult.error.message);
      }

      if (sickNotesResult.error) {
        console.warn("Sick notes:", sickNotesResult.error.message);
      }

      if (documentsResult.error) {
        console.warn("Documents:", documentsResult.error.message);
      }

      setAppointments(appointmentsResult.data || []);
      setConsultations(consultationsResult.data || []);
      setPrescriptions(prescriptionsResult.data || []);
      setInvoices(invoicesResult.data || []);
      setClaims(claimsResult.data || []);
      setSickNotes(sickNotesResult.data || []);
      setDocuments(documentsResult.data || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load patient.");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-ZA");
  }

  function formatDateTime(value: string | null | undefined) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("en-ZA");
  }

  function patientName() {
    if (!patient) return "";

    return [
      patient.title,
      patient.first_name,
      patient.middle_name,
      patient.last_name,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-inner">
          <p className="empty-state">Loading patient file...</p>
        </div>
      </main>
    );
  }

  if (error || !patient) {
    return (
      <main className="page-shell">
        <div className="page-inner">
          <div className="card">
            <div className="card-body">
              <div className="alert-error">
                <h2 className="text-xl font-bold">Unable to load patient</h2>
                <p className="page-subtitle">{error || "Patient not found."}</p>
              </div>
              <button
                onClick={() => router.push("/patients")}
                className="btn btn-primary"
              >
                Back to Patients
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const outstandingBalance = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.balance || 0),
    0
  );

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
              onClick={() => router.push("/patients")}
              className="btn btn-secondary btn-sm"
            >
              ← Patients
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">{patientName()}</h1>

            <p className="page-subtitle">
              <span>
                <strong>Patient ID:</strong> {patient.patient_id}
              </span>

              {patient.date_of_birth && (
                <span>
                  {" "}
                  · <strong>DOB:</strong> {formatDate(patient.date_of_birth)}
                </span>
              )}

              {patient.gender && (
                <span>
                  {" "}
                  · <strong>Gender:</strong> {patient.gender}
                </span>
              )}

              {patient.phone && (
                <span>
                  {" "}
                  · <strong>Phone:</strong> {patient.phone}
                </span>
              )}
            </p>
          </div>

          <CommunicationBar
            phone={patient.phone}
            email={patient.email}
            firstName={patient.first_name}
          />

          <div className="page-actions">
            <button
              onClick={() => router.push(`/patients/${patient.id}/edit`)}
              className="btn btn-secondary"
            >
              Edit Patient
            </button>

            <button
              onClick={() =>
                router.push(`/appointments/new?patient_id=${patient.id}`)
              }
              className="btn btn-primary"
            >
              + Appointment
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <section className="page-actions mb-6">
          <button
            onClick={() =>
              router.push(`/patients/${patient.id}/consultations/new`)
            }
            className="btn btn-secondary"
          >
            🩺 <strong>New Consultation</strong> — Record clinical visit
          </button>

          <button
            onClick={() =>
              router.push(`/patients/${patient.id}/prescriptions/new`)
            }
            className="btn btn-secondary"
          >
            💊 <strong>Prescription</strong> — Create prescription
          </button>

          <button
            onClick={() =>
              router.push(
                `/sick-notes?patient_id=${patient.id}`
              )
            }
            className="btn btn-secondary"
          >
            📄 <strong>Sick Note</strong> — Create sick note
          </button>

          <button
            onClick={() =>
              router.push(`/patients/${patient.id}/billing/new`)
            }
            className="btn btn-secondary"
          >
            💰 <strong>New Invoice</strong> — Create patient invoice
          </button>

          <button
            onClick={() =>
              router.push(`/patients/${patient.id}/documents`)
            }
            className="btn btn-secondary"
          >
            📁 <strong>Documents</strong> — Patient documents
          </button>
        </section>

        {/* Summary */}
        <section className="stat-grid">
          <SummaryCard
            label="Appointments"
            value={appointments.length}
            onClick={() =>
              router.push(`/patients/${patient.id}/appointments`)
            }
          />

          <SummaryCard
            label="Consultations"
            value={consultations.length}
            onClick={() =>
              router.push(`/patients/${patient.id}/consultations`)
            }
          />

          <SummaryCard
            label="Prescriptions"
            value={prescriptions.length}
            onClick={() =>
              router.push(`/patients/${patient.id}/prescriptions`)
            }
          />

          <SummaryCard
            label="Invoices"
            value={invoices.length}
            onClick={() =>
              router.push(`/patients/${patient.id}/billing`)
            }
          />

          <SummaryCard
            label="Claims"
            value={claims.length}
            onClick={() => router.push("/claims")}
          />

          <SummaryCard
            label="Sick Notes"
            value={sickNotes.length}
            onClick={() => router.push("/sick-notes")}
          />

          <SummaryCard
            label="Documents"
            value={documents.length}
            onClick={() =>
              router.push(`/patients/${patient.id}/documents`)
            }
          />

          <SummaryCard
            label="Outstanding"
            value={`R ${outstandingBalance.toFixed(2)}`}
            danger={outstandingBalance > 0}
            onClick={() =>
              router.push(`/patients/${patient.id}/billing`)
            }
          />
        </section>

        {/* Patient Details */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Patient Information</h2>

            <button
              onClick={() => router.push(`/patients/${patient.id}/edit`)}
              className="btn btn-secondary btn-sm"
            >
              Edit
            </button>
          </div>

          <div className="card-body grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Full Name" value={patientName()} />
            <Info label="Patient ID" value={patient.patient_id} />
            <Info label="Date of Birth" value={formatDate(patient.date_of_birth)} />
            <Info label="Gender" value={patient.gender} />
            <Info label="ID Number" value={patient.id_number} />
            <Info label="Passport Number" value={patient.passport_number} />
            <Info label="Phone" value={patient.phone} />
            <Info label="Alternative Phone" value={patient.alternative_phone} />
            <Info label="Email" value={patient.email} />
            <Info label="Occupation" value={patient.occupation} />
            <Info label="Marital Status" value={patient.marital_status} />
            <Info label="Blood Type" value={patient.blood_type} />
          </div>
        </section>

        {/* Medical Information */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Medical Information</h2>
          </div>

          <div className="card-body grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Allergies" value={patient.allergies} wide />
            <Info
              label="Chronic Conditions"
              value={patient.chronic_conditions}
              wide
            />
            <Info label="Notes" value={patient.notes} wide />
          </div>
        </section>

        {/* Medical Aid */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Medical Aid</h2>
          </div>

          <div className="card-body grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info
              label="Medical Aid Provider"
              value={patient.medical_aid_provider}
            />
            <Info
              label="Membership Number"
              value={patient.medical_aid_number}
            />
            <Info label="Plan" value={patient.medical_aid_plan} />
            <Info
              label="Dependent Code"
              value={patient.medical_aid_dependent_code}
            />
            <Info
              label="Main Member"
              value={patient.medical_aid_main_member}
            />
          </div>
        </section>

        {/* Emergency Contact */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Emergency Contact</h2>
          </div>

          <div className="card-body grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info
              label="Name"
              value={patient.emergency_contact_name}
            />
            <Info
              label="Relationship"
              value={patient.emergency_contact_relationship}
            />
            <Info
              label="Phone"
              value={patient.emergency_contact_phone}
            />
          </div>
        </section>

        {/* Address */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Address</h2>
          </div>

          <div className="card-body">
            <p className="text-sm text-slate-700">
              {[ 
                patient.address_line_1,
                patient.address_line_2,
                patient.city,
                patient.province,
                patient.postal_code,
                patient.country,
              ]
                .filter(Boolean)
                .join(", ") || "No address recorded."}
            </p>
          </div>
        </section>

        {/* Recent Consultations */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Consultations</h2>

            <button
              onClick={() =>
                router.push(`/patients/${patient.id}/consultations`)
              }
              className="btn btn-secondary btn-sm"
            >
              View All
            </button>
          </div>

          {consultations.length === 0 ? (
            <div className="card-body">
              <Empty text="No consultations recorded." />
            </div>
          ) : (
            <div className="card-body flex flex-col gap-3">
              {consultations.map((consultation) => (
                <div
                  key={consultation.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div>
                    <strong>
                      {formatDateTime(consultation.consultation_date)}
                    </strong>

                    <div className="mt-1 text-sm text-slate-500">
                      {consultation.chief_complaint || "No chief complaint"}
                    </div>

                    {consultation.diagnosis && (
                      <div className="mt-1 text-sm text-slate-700">
                        <strong>Diagnosis:</strong> {consultation.diagnosis}
                      </div>
                    )}

                    {consultation.treatment && (
                      <div className="mt-1 text-sm text-slate-700">
                        <strong>Treatment:</strong> {consultation.treatment}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      router.push(
                        `/patients/${patient.id}/consultations`
                      )
                    }
                    className="btn btn-secondary btn-sm"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Appointments */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Appointments</h2>

            <button
              onClick={() =>
                router.push(`/patients/${patient.id}/appointments`)
              }
              className="btn btn-secondary btn-sm"
            >
              View All
            </button>
          </div>

          {appointments.length === 0 ? (
            <div className="card-body">
              <Empty text="No appointments recorded." />
            </div>
          ) : (
            <div className="card-body flex flex-col gap-3">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div>
                    <strong>
                      {formatDate(appointment.appointment_date)}{" "}
                      {appointment.start_time?.slice(0, 5)}
                    </strong>

                    <div className="mt-1 text-sm text-slate-500">
                      {appointment.appointment_type || "Appointment"}
                    </div>

                    {appointment.reason && (
                      <div className="mt-1 text-sm text-slate-700">
                        {appointment.reason}
                      </div>
                    )}
                  </div>

                  <StatusBadge status={appointment.status || "scheduled"} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Prescriptions */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Prescriptions</h2>

            <button
              onClick={() =>
                router.push(`/patients/${patient.id}/prescriptions`)
              }
              className="btn btn-secondary btn-sm"
            >
              View All
            </button>
          </div>

          {prescriptions.length === 0 ? (
            <div className="card-body">
              <Empty text="No prescriptions recorded." />
            </div>
          ) : (
            <div className="card-body flex flex-col gap-3">
              {prescriptions.map((prescription) => (
                <div
                  key={prescription.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div>
                    <strong>{prescription.prescription_number}</strong>

                    <div className="mt-1 text-sm text-slate-500">
                      {formatDate(prescription.prescription_date)}
                    </div>
                  </div>

                  <StatusBadge status={prescription.status || "active"} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Billing */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Billing</h2>

            <button
              onClick={() =>
                router.push(`/patients/${patient.id}/billing`)
              }
              className="btn btn-secondary btn-sm"
            >
              View All
            </button>
          </div>

          {invoices.length === 0 ? (
            <div className="card-body">
              <Empty text="No invoices recorded." />
            </div>
          ) : (
            <div className="card-body flex flex-col gap-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div>
                    <strong>{invoice.invoice_number}</strong>

                    <div className="mt-1 text-sm text-slate-500">
                      {formatDate(invoice.invoice_date)}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 whitespace-nowrap">
                    <strong>R {Number(invoice.total || 0).toFixed(2)}</strong>

                    <span
                      className={
                        Number(invoice.balance || 0) > 0
                          ? "badge badge-red"
                          : "badge badge-green"
                      }
                    >
                      Balance: R {Number(invoice.balance || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Claims */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Medical Aid Claims</h2>

            <button
              onClick={() => router.push("/claims")}
              className="btn btn-secondary btn-sm"
            >
              View All
            </button>
          </div>

          {claims.length === 0 ? (
            <div className="card-body">
              <Empty text="No medical aid claims recorded." />
            </div>
          ) : (
            <div className="card-body flex flex-col gap-3">
              {claims.map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div>
                    <strong>{claim.claim_number}</strong>

                    <div className="mt-1 text-sm text-slate-500">
                      {formatDate(claim.claim_date)}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 whitespace-nowrap">
                    <strong>
                      R {Number(claim.claimed_amount || 0).toFixed(2)}
                    </strong>

                    <StatusBadge status={claim.status || "submitted"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sick Notes */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Sick Notes</h2>

            <button
              onClick={() => router.push("/sick-notes")}
              className="btn btn-secondary btn-sm"
            >
              View All
            </button>
          </div>

          {sickNotes.length === 0 ? (
            <div className="card-body">
              <Empty text="No sick notes recorded." />
            </div>
          ) : (
            <div className="card-body flex flex-col gap-3">
              {sickNotes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div>
                    <strong>{note.note_number}</strong>

                    <div className="mt-1 text-sm text-slate-500">
                      Issued: {formatDate(note.issue_date)}
                    </div>

                    <div className="mt-1 text-sm text-slate-700">
                      {formatDate(note.start_date)} →{" "}
                      {formatDate(note.end_date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Documents */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Patient Documents</h2>

            <button
              onClick={() =>
                router.push(`/patients/${patient.id}/documents`)
              }
              className="btn btn-secondary btn-sm"
            >
              View All
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="card-body">
              <Empty text="No patient documents uploaded." />
            </div>
          ) : (
            <div className="card-body flex flex-col gap-3">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div>
                    <strong>
                      {document.document_name ||
                        document.file_name ||
                        "Document"}
                    </strong>

                    <div className="mt-1 text-sm text-slate-500">
                      {document.document_type || "Patient document"}
                    </div>

                    {document.created_at && (
                      <div className="mt-1 text-sm text-slate-700">
                        {formatDateTime(document.created_at)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const value = (status || "").toLowerCase();

  let variant = "badge-gray";

  if (["paid", "completed", "active", "in stock"].includes(value)) {
    variant = "badge-green";
  } else if (
    ["pending", "submitted", "partially paid", "scheduled", "confirmed"].includes(
      value
    )
  ) {
    variant = "badge-blue";
  } else if (["low stock", "no show"].includes(value)) {
    variant = "badge-amber";
  } else if (
    ["cancelled", "rejected", "overdue", "out of stock"].includes(value)
  ) {
    variant = "badge-red";
  }

  return <span className={`badge ${variant}`}>{status || "—"}</span>;
}

function SummaryCard({
  label,
  value,
  onClick,
  danger = false,
}: {
  label: string;
  value: string | number;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button onClick={onClick} className="stat-card text-left cursor-pointer">
      <span className="stat-label">{label}</span>

      <strong
        className={`stat-value block ${danger ? "text-red-700" : ""}`}
      >
        {value}
      </strong>
    </button>
  );
}

function Info({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string | null | undefined;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-3" : ""}>
      <div className="stat-label">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm">{value || "—"}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
