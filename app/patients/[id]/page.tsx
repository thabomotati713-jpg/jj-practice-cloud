"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
        router.push("/");
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
      <main style={styles.page}>
        <div style={styles.loading}>Loading patient file...</div>
      </main>
    );
  }

  if (error || !patient) {
    return (
      <main style={styles.page}>
        <div style={styles.errorBox}>
          <h2>Unable to load patient</h2>
          <p>{error || "Patient not found."}</p>
          <button onClick={() => router.push("/patients")} style={styles.button}>
            Back to Patients
          </button>
        </div>
      </main>
    );
  }

  const outstandingBalance = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.balance || 0),
    0
  );

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <button
              onClick={() => router.push("/patients")}
              style={styles.backButton}
            >
              ← Patients
            </button>

            <h1 style={styles.title}>{patientName()}</h1>

            <div style={styles.patientMeta}>
              <span>
                <strong>Patient ID:</strong> {patient.patient_id}
              </span>

              {patient.date_of_birth && (
                <span>
                  <strong>DOB:</strong> {formatDate(patient.date_of_birth)}
                </span>
              )}

              {patient.gender && (
                <span>
                  <strong>Gender:</strong> {patient.gender}
                </span>
              )}

              {patient.phone && (
                <span>
                  <strong>Phone:</strong> {patient.phone}
                </span>
              )}
            </div>
          </div>

          <div style={styles.headerActions}>
            <button
              onClick={() => router.push(`/patients/${patient.id}/edit`)}
              style={styles.secondaryButton}
            >
              Edit Patient
            </button>

            <button
              onClick={() =>
                router.push(`/appointments/new?patient_id=${patient.id}`)
              }
              style={styles.primaryButton}
            >
              + Appointment
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <section style={styles.quickActions}>
          <button
            onClick={() =>
              router.push(`/patients/${patient.id}/consultations/new`)
            }
            style={styles.actionCard}
          >
            <span style={styles.actionIcon}>🩺</span>
            <strong>New Consultation</strong>
            <small>Record clinical visit</small>
          </button>

          <button
            onClick={() =>
              router.push(`/patients/${patient.id}/prescriptions/new`)
            }
            style={styles.actionCard}
          >
            <span style={styles.actionIcon}>💊</span>
            <strong>Prescription</strong>
            <small>Create prescription</small>
          </button>

          <button
            onClick={() =>
              router.push(
                `/sick-notes?patient_id=${patient.id}`
              )
            }
            style={styles.actionCard}
          >
            <span style={styles.actionIcon}>📄</span>
            <strong>Sick Note</strong>
            <small>Create sick note</small>
          </button>

          <button
            onClick={() =>
              router.push(`/patients/${patient.id}/billing/new`)
            }
            style={styles.actionCard}
          >
            <span style={styles.actionIcon}>💰</span>
            <strong>New Invoice</strong>
            <small>Create patient invoice</small>
          </button>

          <button
            onClick={() =>
              router.push(`/patients/${patient.id}/documents`)
            }
            style={styles.actionCard}
          >
            <span style={styles.actionIcon}>📁</span>
            <strong>Documents</strong>
            <small>Patient documents</small>
          </button>
        </section>

        {/* Summary */}
        <section style={styles.summaryGrid}>
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
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Patient Information</h2>

            <button
              onClick={() => router.push(`/patients/${patient.id}/edit`)}
              style={styles.linkButton}
            >
              Edit
            </button>
          </div>

          <div style={styles.detailsGrid}>
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
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Medical Information</h2>

          <div style={styles.detailsGrid}>
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
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Medical Aid</h2>

          <div style={styles.detailsGrid}>
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
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Emergency Contact</h2>

          <div style={styles.detailsGrid}>
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
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Address</h2>

          <div style={styles.address}>
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
          </div>
        </section>

        {/* Recent Consultations */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Recent Consultations</h2>

            <button
              onClick={() =>
                router.push(`/patients/${patient.id}/consultations`)
              }
              style={styles.linkButton}
            >
              View All
            </button>
          </div>

          {consultations.length === 0 ? (
            <Empty text="No consultations recorded." />
          ) : (
            <div style={styles.list}>
              {consultations.map((consultation) => (
                <div key={consultation.id} style={styles.listItem}>
                  <div>
                    <strong>
                      {formatDateTime(consultation.consultation_date)}
                    </strong>

                    <div style={styles.muted}>
                      {consultation.chief_complaint || "No chief complaint"}
                    </div>

                    {consultation.diagnosis && (
                      <div style={styles.detailText}>
                        <strong>Diagnosis:</strong> {consultation.diagnosis}
                      </div>
                    )}

                    {consultation.treatment && (
                      <div style={styles.detailText}>
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
                    style={styles.smallButton}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Appointments */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Recent Appointments</h2>

            <button
              onClick={() =>
                router.push(`/patients/${patient.id}/appointments`)
              }
              style={styles.linkButton}
            >
              View All
            </button>
          </div>

          {appointments.length === 0 ? (
            <Empty text="No appointments recorded." />
          ) : (
            <div style={styles.list}>
              {appointments.map((appointment) => (
                <div key={appointment.id} style={styles.listItem}>
                  <div>
                    <strong>
                      {formatDate(appointment.appointment_date)}{" "}
                      {appointment.start_time?.slice(0, 5)}
                    </strong>

                    <div style={styles.muted}>
                      {appointment.appointment_type || "Appointment"}
                    </div>

                    {appointment.reason && (
                      <div style={styles.detailText}>
                        {appointment.reason}
                      </div>
                    )}
                  </div>

                  <span style={styles.status}>
                    {appointment.status || "scheduled"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Prescriptions */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Recent Prescriptions</h2>

            <button
              onClick={() =>
                router.push(`/patients/${patient.id}/prescriptions`)
              }
              style={styles.linkButton}
            >
              View All
            </button>
          </div>

          {prescriptions.length === 0 ? (
            <Empty text="No prescriptions recorded." />
          ) : (
            <div style={styles.list}>
              {prescriptions.map((prescription) => (
                <div key={prescription.id} style={styles.listItem}>
                  <div>
                    <strong>{prescription.prescription_number}</strong>

                    <div style={styles.muted}>
                      {formatDate(prescription.prescription_date)}
                    </div>
                  </div>

                  <span style={styles.status}>
                    {prescription.status || "active"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Billing */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Recent Billing</h2>

            <button
              onClick={() =>
                router.push(`/patients/${patient.id}/billing`)
              }
              style={styles.linkButton}
            >
              View All
            </button>
          </div>

          {invoices.length === 0 ? (
            <Empty text="No invoices recorded." />
          ) : (
            <div style={styles.list}>
              {invoices.map((invoice) => (
                <div key={invoice.id} style={styles.listItem}>
                  <div>
                    <strong>{invoice.invoice_number}</strong>

                    <div style={styles.muted}>
                      {formatDate(invoice.invoice_date)}
                    </div>
                  </div>

                  <div style={styles.amountBlock}>
                    <strong>R {Number(invoice.total || 0).toFixed(2)}</strong>

                    <span
                      style={{
                        color:
                          Number(invoice.balance || 0) > 0
                            ? "#b91c1c"
                            : "#166534",
                      }}
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
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Medical Aid Claims</h2>

            <button
              onClick={() => router.push("/claims")}
              style={styles.linkButton}
            >
              View All
            </button>
          </div>

          {claims.length === 0 ? (
            <Empty text="No medical aid claims recorded." />
          ) : (
            <div style={styles.list}>
              {claims.map((claim) => (
                <div key={claim.id} style={styles.listItem}>
                  <div>
                    <strong>{claim.claim_number}</strong>

                    <div style={styles.muted}>
                      {formatDate(claim.claim_date)}
                    </div>
                  </div>

                  <div style={styles.amountBlock}>
                    <strong>
                      R {Number(claim.claimed_amount || 0).toFixed(2)}
                    </strong>

                    <span style={styles.status}>{claim.status || "submitted"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sick Notes */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Sick Notes</h2>

            <button
              onClick={() => router.push("/sick-notes")}
              style={styles.linkButton}
            >
              View All
            </button>
          </div>

          {sickNotes.length === 0 ? (
            <Empty text="No sick notes recorded." />
          ) : (
            <div style={styles.list}>
              {sickNotes.map((note) => (
                <div key={note.id} style={styles.listItem}>
                  <div>
                    <strong>{note.note_number}</strong>

                    <div style={styles.muted}>
                      Issued: {formatDate(note.issue_date)}
                    </div>

                    <div style={styles.detailText}>
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
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Patient Documents</h2>

            <button
              onClick={() =>
                router.push(`/patients/${patient.id}/documents`)
              }
              style={styles.linkButton}
            >
              View All
            </button>
          </div>

          {documents.length === 0 ? (
            <Empty text="No patient documents uploaded." />
          ) : (
            <div style={styles.list}>
              {documents.map((document) => (
                <div key={document.id} style={styles.listItem}>
                  <div>
                    <strong>
                      {document.document_name ||
                        document.file_name ||
                        "Document"}
                    </strong>

                    <div style={styles.muted}>
                      {document.document_type || "Patient document"}
                    </div>

                    {document.created_at && (
                      <div style={styles.detailText}>
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
    <button
      onClick={onClick}
      style={{
        ...styles.summaryCard,
        borderColor: danger ? "#fecaca" : "#e5e7eb",
      }}
    >
      <span style={styles.summaryLabel}>{label}</span>

      <strong
        style={{
          ...styles.summaryValue,
          color: danger ? "#b91c1c" : "#111827",
        }}
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
    <div
      style={{
        ...styles.info,
        gridColumn: wide ? "1 / -1" : undefined,
      }}
    >
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value || "—"}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={styles.empty}>{text}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "24px",
    color: "#111827",
  },

  container: {
    maxWidth: "1400px",
    margin: "0 auto",
  },

  loading: {
    maxWidth: "1400px",
    margin: "80px auto",
    textAlign: "center",
    fontSize: "18px",
  },

  errorBox: {
    maxWidth: "600px",
    margin: "80px auto",
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "30px",
    textAlign: "center",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "18px",
  },

  backButton: {
    border: "none",
    background: "transparent",
    padding: "0",
    marginBottom: "10px",
    color: "#2563eb",
    cursor: "pointer",
    fontSize: "14px",
  },

  title: {
    margin: "0 0 10px",
    fontSize: "30px",
    fontWeight: 700,
  },

  patientMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px 20px",
    color: "#4b5563",
    fontSize: "14px",
  },

  headerActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  primaryButton: {
    border: "none",
    background: "#2563eb",
    color: "white",
    borderRadius: "8px",
    padding: "11px 16px",
    cursor: "pointer",
    fontWeight: 600,
  },

  secondaryButton: {
    border: "1px solid #d1d5db",
    background: "white",
    color: "#111827",
    borderRadius: "8px",
    padding: "11px 16px",
    cursor: "pointer",
    fontWeight: 600,
  },

  button: {
    border: "none",
    background: "#2563eb",
    color: "white",
    borderRadius: "8px",
    padding: "11px 16px",
    cursor: "pointer",
    fontWeight: 600,
  },

  quickActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "12px",
    marginBottom: "18px",
  },

  actionCard: {
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: "12px",
    padding: "16px",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },

  actionIcon: {
    fontSize: "24px",
    marginBottom: "4px",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
    marginBottom: "18px",
  },

  summaryCard: {
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: "12px",
    padding: "17px",
    textAlign: "left",
    cursor: "pointer",
    minHeight: "95px",
  },

  summaryLabel: {
    display: "block",
    color: "#6b7280",
    fontSize: "13px",
    marginBottom: "8px",
  },

  summaryValue: {
    fontSize: "24px",
  },

  section: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "20px",
    marginBottom: "18px",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    marginBottom: "15px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "19px",
  },

  linkButton: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    cursor: "pointer",
    fontWeight: 600,
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "1px",
    background: "#e5e7eb",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    overflow: "hidden",
  },

  info: {
    background: "white",
    padding: "14px",
    minHeight: "65px",
  },

  infoLabel: {
    fontSize: "12px",
    color: "#6b7280",
    marginBottom: "5px",
    fontWeight: 600,
  },

  infoValue: {
    fontSize: "14px",
    whiteSpace: "pre-wrap",
  },

  address: {
    background: "#f9fafb",
    borderRadius: "10px",
    padding: "15px",
    color: "#374151",
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "14px",
  },

  muted: {
    color: "#6b7280",
    fontSize: "13px",
    marginTop: "4px",
  },

  detailText: {
    color: "#374151",
    fontSize: "13px",
    marginTop: "5px",
  },

  status: {
    display: "inline-block",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },

  smallButton: {
    border: "1px solid #d1d5db",
    background: "white",
    borderRadius: "7px",
    padding: "7px 11px",
    cursor: "pointer",
  },

  amountBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "5px",
    whiteSpace: "nowrap",
  },

  empty: {
    border: "1px dashed #d1d5db",
    borderRadius: "10px",
    padding: "20px",
    textAlign: "center",
    color: "#6b7280",
    background: "#f9fafb",
  },
};
