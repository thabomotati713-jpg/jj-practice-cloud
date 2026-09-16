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
          <div className="empty-state">Loading consultations...</div>
        </div>
      </main>
    );
  }

  if (error || !patient) {
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
          <div className="card">
            <div className="card-body text-center">
              <h2 className="card-title">Unable to load consultations</h2>

              <div className="alert-error">{error || "Patient not found."}</div>

              <button
                onClick={() => router.push(`/patients/${patientId}`)}
                className="btn btn-primary"
              >
                Back to Patient
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

          <button
            onClick={() => router.push(`/patients/${patientId}`)}
            className="btn btn-secondary btn-sm"
          >
            ← Patient File
          </button>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Consultation History</h1>

            <div className="page-subtitle flex flex-wrap gap-x-4 gap-y-1">
              <strong className="text-[color:var(--foreground)]">
                {patientName()}
              </strong>
              <span>Patient ID: {patient.patient_id}</span>

              {patient.date_of_birth && (
                <span>DOB: {formatDate(patient.date_of_birth)}</span>
              )}

              {patient.phone && <span>Phone: {patient.phone}</span>}
            </div>
          </div>

          <div className="page-actions">
            <button
              onClick={() =>
                router.push(`/patients/${patientId}/appointments`)
              }
              className="btn btn-secondary"
            >
              Appointments
            </button>

            <button
              onClick={() =>
                router.push(`/patients/${patientId}/consultations/new`)
              }
              className="btn btn-primary"
            >
              + New Consultation
            </button>
          </div>
        </div>

        <section className="stat-grid">
          <div className="stat-card">
            <span className="stat-label">Total Consultations</span>
            <div className="stat-value">{consultations.length}</div>
          </div>

          <div className="stat-card">
            <span className="stat-label">Showing</span>
            <div className="stat-value">{filteredConsultations.length}</div>
          </div>

          <div className="stat-card">
            <span className="stat-label">Latest Visit</span>
            <div className="stat-value">
              {consultations.length > 0
                ? formatDate(consultations[0].consultation_date)
                : "—"}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-body flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search diagnosis, complaint, treatment, provider..."
              className="input flex-1"
            />

            {search && (
              <button
                onClick={() => setSearch("")}
                className="btn btn-secondary btn-sm"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {filteredConsultations.length === 0 ? (
          <section className="card">
            <div className="empty-state">
              <h2 className="card-title">No consultations found</h2>

              <p className="mt-2">
                {search
                  ? "Try a different search term."
                  : "This patient does not have any consultations yet."}
              </p>

              {!search && (
                <div className="mt-4">
                  <button
                    onClick={() =>
                      router.push(`/patients/${patientId}/consultations/new`)
                    }
                    className="btn btn-primary"
                  >
                    + Start Consultation
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-4">
            {filteredConsultations.map((consultation, index) => {
              const expanded = expandedId === consultation.id;
              const appointment = consultation.appointment_id
                ? appointments[consultation.appointment_id]
                : null;

              return (
                <article key={consultation.id} className="card">
                  <div className="card-header">
                    <div className="flex items-start gap-4">
                      <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                        {filteredConsultations.length - index}
                      </div>

                      <div>
                        <h2 className="card-title">
                          {consultation.diagnosis ||
                            consultation.chief_complaint ||
                            "Clinical Consultation"}
                        </h2>

                        <div className="mt-1 text-sm text-slate-600">
                          {formatDateTime(consultation.consultation_date)}
                        </div>

                        <div className="mt-0.5 text-sm text-muted">
                          Provider: {providerName(consultation.provider_id)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        setExpandedId(expanded ? null : consultation.id)
                      }
                      className="btn btn-secondary btn-sm whitespace-nowrap"
                    >
                      {expanded ? "Collapse" : "View Details"}
                    </button>
                  </div>

                  <div className="card-body">
                    {appointment && (
                      <div className="alert-info flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
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

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                      <div className="mt-5 border-t border-line pt-5">
                        <h3 className="mb-3 text-[15px] font-bold">
                          Clinical Details
                        </h3>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

                        <h3 className="mb-3 mt-5 text-[15px] font-bold">
                          Vital Signs
                        </h3>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
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

                        <div className="page-actions mt-5">
                          <button
                            onClick={() =>
                              router.push(
                                `/patients/${patientId}/prescriptions/new?consultation_id=${consultation.id}`
                              )
                            }
                            className="btn btn-secondary btn-sm"
                          >
                            💊 Prescription
                          </button>

                          <button
                            onClick={() =>
                              router.push(
                                `/sick-notes?patient_id=${patientId}&consultation_id=${consultation.id}`
                              )
                            }
                            className="btn btn-secondary btn-sm"
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
      className={`rounded-xl border border-line bg-slate-50 p-3 ${
        wide ? "col-span-full" : ""
      }`}
    >
      <span className="stat-label block">{label}</span>
      <div className="mt-1 whitespace-pre-wrap text-[13px]">
        {value || "—"}
      </div>
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
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-slate-50 p-3">
      <span className="stat-label">{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}
