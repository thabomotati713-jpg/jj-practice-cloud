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
  phone: string | null;
};

type Consultation = {
  id: string;
  consultation_date: string;
  appointment_id: string | null;
  provider_id: string | null;
  chief_complaint: string | null;
  history_of_present_illness: string | null;
  temperature: number | null;
  pulse: number | null;
  respiratory_rate: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  oxygen_saturation: number | null;
  weight: number | null;
  height: number | null;
  examination: string | null;
  diagnosis: string | null;
  diagnosis_code: string | null;
  treatment: string | null;
  procedures: string | null;
  clinical_notes: string | null;
  follow_up_notes: string | null;
  follow_up_date: string | null;
};

type Provider = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
};

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  appointment_type: string | null;
  reason: string | null;
};

export default function ConsultationHistoryPage() {
  const params = useParams();
  const router = useRouter();

  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [appointments, setAppointments] = useState<Record<string, Appointment>>(
    {}
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [patientId]);

  async function loadData() {
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
        .select(
          "id, patient_id, title, first_name, middle_name, last_name, date_of_birth, phone"
        )
        .eq("id", patientId)
        .eq("practice_id", practiceId)
        .single();

      if (patientError) {
        throw new Error(patientError.message);
      }

      setPatient(patientData);

      const { data: consultationData, error: consultationError } =
        await supabase
          .from("consultations")
          .select(
            `
              id,
              consultation_date,
              appointment_id,
              provider_id,
              chief_complaint,
              history_of_present_illness,
              temperature,
              pulse,
              respiratory_rate,
              blood_pressure_systolic,
              blood_pressure_diastolic,
              oxygen_saturation,
              weight,
              height,
              examination,
              diagnosis,
              diagnosis_code,
              treatment,
              procedures,
              clinical_notes,
              follow_up_notes,
              follow_up_date
            `
          )
          .eq("patient_id", patientId)
          .eq("practice_id", practiceId)
          .order("consultation_date", { ascending: false });

      if (consultationError) {
        throw new Error(consultationError.message);
      }

      const loadedConsultations = consultationData || [];
      setConsultations(loadedConsultations);

      const providerIds = Array.from(
        new Set(
          loadedConsultations
            .map((item) => item.provider_id)
            .filter(Boolean) as string[]
        )
      );

      if (providerIds.length > 0) {
        const { data: providerData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, display_name")
          .in("id", providerIds);

        const providerMap: Record<string, Provider> = {};

        (providerData || []).forEach((provider) => {
          providerMap[provider.id] = provider;
        });

        setProviders(providerMap);
      } else {
        setProviders({});
      }

      const appointmentIds = Array.from(
        new Set(
          loadedConsultations
            .map((item) => item.appointment_id)
            .filter(Boolean) as string[]
        )
      );

      if (appointmentIds.length > 0) {
        const { data: appointmentData } = await supabase
          .from("appointments")
          .select(
            "id, appointment_date, start_time, appointment_type, reason"
          )
          .in("id", appointmentIds)
          .eq("practice_id", practiceId);

        const appointmentMap: Record<string, Appointment> = {};

        (appointmentData || []).forEach((appointment) => {
          appointmentMap[appointment.id] = appointment;
        });

        setAppointments(appointmentMap);
      } else {
        setAppointments({});
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to load consultations."
      );
    } finally {
      setLoading(false);
    }
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

  function providerName(providerId: string | null) {
    if (!providerId) return "Provider not recorded";

    const provider = providers[providerId];

    if (!provider) return "Provider";

    return (
      provider.display_name ||
      [provider.first_name, provider.last_name].filter(Boolean).join(" ") ||
      "Provider"
    );
  }

  const filteredConsultations = consultations.filter((consultation) => {
    const text = [
      consultation.chief_complaint,
      consultation.history_of_present_illness,
      consultation.diagnosis,
      consultation.diagnosis_code,
      consultation.treatment,
      consultation.procedures,
      consultation.clinical_notes,
      consultation.follow_up_notes,
      providerName(consultation.provider_id),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(search.toLowerCase());
  });

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>Loading consultations...</div>
      </main>
    );
  }

  if (error || !patient) {
    return (
      <main style={styles.page}>
        <div style={styles.errorBox}>
          <h2>Unable to load consultations</h2>
          <p>{error || "Patient not found."}</p>

          <button
            onClick={() => router.push(`/patients/${patientId}`)}
            style={styles.primaryButton}
          >
            Back to Patient
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <button
              onClick={() => router.push(`/patients/${patientId}`)}
              style={styles.backButton}
            >
              ← Patient File
            </button>

            <h1 style={styles.title}>Consultation History</h1>

            <div style={styles.patientMeta}>
              <strong>{patientName()}</strong>
              <span>Patient ID: {patient.patient_id}</span>

              {patient.date_of_birth && (
                <span>DOB: {formatDate(patient.date_of_birth)}</span>
              )}

              {patient.phone && <span>Phone: {patient.phone}</span>}
            </div>
          </div>

          <div style={styles.actions}>
            <button
              onClick={() =>
                router.push(`/patients/${patientId}/appointments`)
              }
              style={styles.secondaryButton}
            >
              Appointments
            </button>

            <button
              onClick={() =>
                router.push(`/patients/${patientId}/consultations/new`)
              }
              style={styles.primaryButton}
            >
              + New Consultation
            </button>
          </div>
        </header>

        <section style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <span>Total Consultations</span>
            <strong>{consultations.length}</strong>
          </div>

          <div style={styles.summaryCard}>
            <span>Showing</span>
            <strong>{filteredConsultations.length}</strong>
          </div>

          <div style={styles.summaryCard}>
            <span>Latest Visit</span>
            <strong>
              {consultations.length > 0
                ? formatDate(consultations[0].consultation_date)
                : "—"}
            </strong>
          </div>
        </section>

        <section style={styles.searchPanel}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search diagnosis, complaint, treatment, provider..."
            style={styles.searchInput}
          />

          {search && (
            <button
              onClick={() => setSearch("")}
              style={styles.clearButton}
            >
              Clear
            </button>
          )}
        </section>

        {filteredConsultations.length === 0 ? (
          <section style={styles.emptyBox}>
            <h2>No consultations found</h2>

            <p>
              {search
                ? "Try a different search term."
                : "This patient does not have any consultations yet."}
            </p>

            {!search && (
              <button
                onClick={() =>
                  router.push(`/patients/${patientId}/consultations/new`)
                }
                style={styles.primaryButton}
              >
                + Start Consultation
              </button>
            )}
          </section>
        ) : (
          <section style={styles.timeline}>
            {filteredConsultations.map((consultation, index) => {
              const expanded = expandedId === consultation.id;
              const appointment = consultation.appointment_id
                ? appointments[consultation.appointment_id]
                : null;

              return (
                <article key={consultation.id} style={styles.card}>
                  <div style={styles.timelineMarker}>
                    <div style={styles.markerCircle}>
                      {filteredConsultations.length - index}
                    </div>
                  </div>

                  <div style={styles.cardContent}>
                    <div style={styles.cardHeader}>
                      <div>
                        <h2 style={styles.cardTitle}>
                          {consultation.diagnosis ||
                            consultation.chief_complaint ||
                            "Clinical Consultation"}
                        </h2>

                        <div style={styles.dateLine}>
                          {formatDateTime(consultation.consultation_date)}
                        </div>

                        <div style={styles.providerLine}>
                          Provider: {providerName(consultation.provider_id)}
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          setExpandedId(expanded ? null : consultation.id)
                        }
                        style={styles.smallButton}
                      >
                        {expanded ? "Collapse" : "View Details"}
                      </button>
                    </div>

                    {appointment && (
                      <div style={styles.appointmentBox}>
                        <strong>Linked Appointment</strong>

                        <span>
                          {formatDate(appointment.appointment_date)}{" "}
                          {appointment.start_time?.slice(0, 5)}
                        </span>

                        {appointment.appointment_type && (
                          <span>{appointment.appointment_type}</span>
                        )}

                        {appointment.reason && (
                          <span>{appointment.reason}</span>
                        )}
                      </div>
                    )}

                    <div style={styles.quickInfoGrid}>
                      <Info
                        label="Chief Complaint"
                        value={consultation.chief_complaint}
                      />

                      <Info
                        label="Diagnosis"
                        value={consultation.diagnosis}
                      />

                      <Info
                        label="Treatment"
                        value={consultation.treatment}
                      />

                      <Info
                        label="Follow-up"
                        value={
                          consultation.follow_up_date
                            ? formatDate(consultation.follow_up_date)
                            : consultation.follow_up_notes
                        }
                      />
                    </div>

                    {expanded && (
                      <div style={styles.expandedArea}>
                        <h3 style={styles.subheading}>
                          Clinical Details
                        </h3>

                        <div style={styles.detailGrid}>
                          <Info
                            label="History of Present Illness"
                            value={consultation.history_of_present_illness}
                            wide
                          />

                          <Info
                            label="Examination"
                            value={consultation.examination}
                            wide
                          />

                          <Info
                            label="Diagnosis Code"
                            value={consultation.diagnosis_code}
                          />

                          <Info
                            label="Procedures"
                            value={consultation.procedures}
                          />

                          <Info
                            label="Clinical Notes"
                            value={consultation.clinical_notes}
                            wide
                          />

                          <Info
                            label="Follow-up Notes"
                            value={consultation.follow_up_notes}
                            wide
                          />
                        </div>

                        <h3 style={styles.subheading}>Vital Signs</h3>

                        <div style={styles.vitalsGrid}>
                          <Vital
                            label="Temperature"
                            value={
                              consultation.temperature !== null
                                ? `${consultation.temperature} °C`
                                : null
                            }
                          />

                          <Vital
                            label="Pulse"
                            value={
                              consultation.pulse !== null
                                ? `${consultation.pulse} bpm`
                                : null
                            }
                          />

                          <Vital
                            label="Respiratory Rate"
                            value={
                              consultation.respiratory_rate !== null
                                ? `${consultation.respiratory_rate} /min`
                                : null
                            }
                          />

                          <Vital
                            label="Blood Pressure"
                            value={
                              consultation.blood_pressure_systolic !== null &&
                              consultation.blood_pressure_diastolic !== null
                                ? `${consultation.blood_pressure_systolic}/${consultation.blood_pressure_diastolic} mmHg`
                                : null
                            }
                          />

                          <Vital
                            label="Oxygen Saturation"
                            value={
                              consultation.oxygen_saturation !== null
                                ? `${consultation.oxygen_saturation}%`
                                : null
                            }
                          />

                          <Vital
                            label="Weight"
                            value={
                              consultation.weight !== null
                                ? `${consultation.weight} kg`
                                : null
                            }
                          />

                          <Vital
                            label="Height"
                            value={
                              consultation.height !== null
                                ? `${consultation.height} cm`
                                : null
                            }
                          />
                        </div>

                        <div style={styles.actionRow}>
                          <button
                            onClick={() =>
                              router.push(
                                `/patients/${patientId}/prescriptions/new?consultation_id=${consultation.id}`
                              )
                            }
                            style={styles.secondaryButton}
                          >
                            💊 Prescription
                          </button>

                          <button
                            onClick={() =>
                              router.push(
                                `/sick-notes?patient_id=${patientId}&consultation_id=${consultation.id}`
                              )
                            }
                            style={styles.secondaryButton}
                          >
                            📄 Sick Note
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function Info({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string | number | null | undefined;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.info,
        gridColumn: wide ? "1 / -1" : undefined,
      }}
    >
      <span style={styles.infoLabel}>{label}</span>
      <div style={styles.infoValue}>{value || "—"}</div>
    </div>
  );
}

function Vital({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div style={styles.vital}>
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
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
    maxWidth: "800px",
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
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "16px",
  },

  backButton: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    padding: 0,
    cursor: "pointer",
    marginBottom: "10px",
  },

  title: {
    margin: "0 0 10px",
    fontSize: "28px",
  },

  patientMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 18px",
    color: "#6b7280",
    fontSize: "14px",
  },

  actions: {
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
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },

  summaryCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "16px",
  },

  searchPanel: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "12px",
    display: "flex",
    gap: "10px",
    marginBottom: "18px",
  },

  searchInput: {
    flex: 1,
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "11px 12px",
    fontSize: "14px",
    outline: "none",
  },

  clearButton: {
    border: "1px solid #d1d5db",
    background: "white",
    borderRadius: "8px",
    padding: "0 14px",
    cursor: "pointer",
  },

  emptyBox: {
    background: "white",
    border: "1px dashed #cbd5e1",
    borderRadius: "14px",
    padding: "45px 20px",
    textAlign: "center",
  },

  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  card: {
    display: "flex",
    gap: "14px",
    alignItems: "flex-start",
  },

  timelineMarker: {
    width: "42px",
    display: "flex",
    justifyContent: "center",
    paddingTop: "18px",
  },

  markerCircle: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "#2563eb",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 700,
  },

  cardContent: {
    flex: 1,
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "18px",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "15px",
  },

  cardTitle: {
    margin: 0,
    fontSize: "18px",
  },

  dateLine: {
    marginTop: "5px",
    color: "#374151",
    fontSize: "14px",
  },

  providerLine: {
    marginTop: "4px",
    color: "#6b7280",
    fontSize: "13px",
  },

  smallButton: {
    border: "1px solid #d1d5db",
    background: "white",
    borderRadius: "7px",
    padding: "7px 11px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  appointmentBox: {
    marginTop: "14px",
    padding: "11px 13px",
    background: "#eff6ff",
    border: "1px solid #dbeafe",
    borderRadius: "9px",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 15px",
    fontSize: "13px",
  },

  quickInfoGrid: {
    marginTop: "15px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "10px",
  },

  info: {
    border: "1px solid #e5e7eb",
    borderRadius: "9px",
    padding: "11px",
    background: "#fafafa",
  },

  infoLabel: {
    display: "block",
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: 600,
    marginBottom: "4px",
  },

  infoValue: {
    fontSize: "13px",
    whiteSpace: "pre-wrap",
  },

  expandedArea: {
    marginTop: "18px",
    paddingTop: "18px",
    borderTop: "1px solid #e5e7eb",
  },

  subheading: {
    fontSize: "15px",
    margin: "0 0 10px",
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "10px",
    marginBottom: "18px",
  },

  vitalsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "10px",
    marginBottom: "18px",
  },

  vital: {
    border: "1px solid #e5e7eb",
    borderRadius: "9px",
    padding: "11px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    background: "#fafafa",
  },

  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
};
