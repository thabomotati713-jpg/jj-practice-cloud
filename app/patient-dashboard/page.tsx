"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Patient = {
  id: string;
  patient_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  appointment_type: string | null;
  reason: string | null;
  status: string | null;
};

type Prescription = {
  id: string;
  prescription_number: string | null;
  prescription_date: string;
  status: string | null;
};

type Consultation = {
  id: string;
  consultation_date: string;
  diagnosis: string | null;
};

type PatientData = {
  patient: Patient | null;
  upcomingAppointments: number;
  activePrescriptions: number;
  nextAppointment: Appointment | null;
  recentConsultations: Consultation[];
};

export default function PatientDashboardPage() {
  const [activeTab, setActiveTab] = useState("Home");

  const [data, setData] = useState<PatientData>({
    patient: null,
    upcomingAppointments: 0,
    activePrescriptions: 0,
    nextAppointment: null,
    recentConsultations: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        window.location.href = "/";
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("patient_id")
        .eq("id", userData.user.id)
        .single();

      if (profileError) {
        setError(profileError.message);
        return;
      }

      if (!profile?.patient_id) {
        setError(
          "Your account has not yet been linked to a patient record. Please contact your medical practice."
        );
        return;
      }

      const patientId = profile.patient_id;

      const today = new Date().toISOString().split("T")[0];

      const [
        patientResult,
        appointmentsResult,
        nextAppointmentResult,
        prescriptionsResult,
        consultationsResult,
      ] = await Promise.all([
        supabase
          .from("patients")
          .select(
            "id, patient_id, first_name, middle_name, last_name"
          )
          .eq("id", patientId)
          .single(),

        supabase
          .from("appointments")
          .select("id")
          .eq("patient_id", patientId)
          .gte("appointment_date", today)
          .not("status", "in", '("cancelled","completed")'),

        supabase
          .from("appointments")
          .select(
            "id, appointment_date, start_time, appointment_type, reason, status"
          )
          .eq("patient_id", patientId)
          .gte("appointment_date", today)
          .not("status", "in", '("cancelled","completed")')
          .order("appointment_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(1)
          .maybeSingle(),

        supabase
          .from("prescriptions")
          .select("id, prescription_number, prescription_date, status")
          .eq("patient_id", patientId)
          .eq("status", "active"),

        supabase
          .from("consultations")
          .select("id, consultation_date, diagnosis")
          .eq("patient_id", patientId)
          .order("consultation_date", { ascending: false })
          .limit(5),
      ]);

      if (patientResult.error) {
        setError(patientResult.error.message);
        return;
      }

      if (appointmentsResult.error) {
        setError(appointmentsResult.error.message);
        return;
      }

      if (nextAppointmentResult.error) {
        setError(nextAppointmentResult.error.message);
        return;
      }

      if (prescriptionsResult.error) {
        setError(prescriptionsResult.error.message);
        return;
      }

      if (consultationsResult.error) {
        setError(consultationsResult.error.message);
        return;
      }

      setData({
        patient: patientResult.data as Patient,
        upcomingAppointments:
          appointmentsResult.data?.length || 0,
        activePrescriptions:
          prescriptionsResult.data?.length || 0,
        nextAppointment:
          nextAppointmentResult.data as Appointment | null,
        recentConsultations:
          (consultationsResult.data || []) as Consultation[],
      });
    } catch (err) {
      console.error("Patient dashboard error:", err);

      setError(
        "Something went wrong while loading your healthcare information."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatPatientName(patient: Patient) {
    return [
      patient.first_name,
      patient.middle_name,
      patient.last_name,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function getInitials(patient: Patient) {
    return `${patient.first_name.charAt(0)}${patient.last_name.charAt(
      0
    )}`.toUpperCase();
  }

  function formatDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString(
      "en-ZA",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );
  }

  function formatTime(time: string) {
    if (!time) return "";

    return time.slice(0, 5);
  }

  const patient = data.patient;

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-inner">
          <div className="empty-state">
            Loading your healthcare information...
          </div>
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
              <span className="app-brand-name">
                J&J Practice Cloud
              </span>
            </a>
          </div>
        </header>

        <div className="page-inner">
          <div className="page-header">
            <div>
              <h1 className="page-title">Patient Portal</h1>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="alert-error">
                {error ||
                  "Your patient record could not be found."}
              </div>

              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                className="btn btn-primary"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const modules = [
    {
      title: "Appointments",
      icon: "📅",
      text: "Book or manage your visits",
      href: "/patient-dashboard/appointments",
    },
    {
      title: "Consultations",
      icon: "🩺",
      text: "Your consultation history",
      href: "/patient-dashboard/consultations",
    },
    {
      title: "Prescriptions",
      icon: "💊",
      text: "View your medication",
      href: "/patient-dashboard/prescriptions",
    },
    {
      title: "Sick Notes",
      icon: "📝",
      text: "Your medical certificates",
      href: "/patient-dashboard/sick-notes",
    },
    {
      title: "Documents",
      icon: "📄",
      text: "Important medical documents",
      href: "/patient-dashboard/documents",
    },
    {
      title: "Billing",
      icon: "💳",
      text: "Invoices and payments",
      href: "/patient-dashboard/billing",
    },
  ];

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
            <span className="app-brand-name">
              J&J Practice Cloud
            </span>
          </a>

          <div className="page-actions">
            <span className="badge badge-blue">
              Welcome, {patient.first_name}
            </span>

            <div className="badge badge-gray">
              {getInitials(patient)}
            </div>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="btn btn-secondary btn-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner pb-32">
        <div className="page-header">
          <div>
            <p className="page-subtitle">
              Your healthcare, simplified
            </p>
            <h1 className="page-title">
              Hello, {patient.first_name}. Your health. One
              place.
            </h1>
            <p className="page-subtitle">
              Manage your appointments, prescriptions,
              documents and healthcare journey from one secure
              patient portal.
            </p>
          </div>

          <div className="page-actions">
            <button
              type="button"
              onClick={() => {
                window.location.href =
                  "/patient-dashboard/appointments";
              }}
              className="btn btn-primary"
            >
              Book an Appointment
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href =
                  "/patient-dashboard/profile";
              }}
              className="btn btn-secondary"
            >
              View My Profile
            </button>
          </div>
        </div>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Next Appointment</h2>
          </div>

          <div className="card-body">
            {data.nextAppointment ? (
              <>
                <p className="stat-value">
                  {formatDate(
                    data.nextAppointment.appointment_date
                  )}
                </p>

                <p className="page-subtitle">
                  {formatTime(
                    data.nextAppointment.start_time
                  )}
                  {data.nextAppointment.appointment_type
                    ? ` • ${data.nextAppointment.appointment_type}`
                    : ""}
                </p>
              </>
            ) : (
              <>
                <p className="stat-value">
                  No appointment yet
                </p>

                <p className="page-subtitle">
                  Book your next visit
                </p>
              </>
            )}

            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    "/patient-dashboard/appointments";
                }}
                className="btn btn-primary btn-sm"
              >
                {data.nextAppointment
                  ? "View Appointments"
                  : "Book Appointment"}
              </button>
            </div>
          </div>
        </section>

        <section className="stat-grid">
          {[
            [
              "Patient ID",
              patient.patient_id,
              "Your unique patient number",
            ],
            [
              "Appointments",
              String(data.upcomingAppointments),
              "Upcoming visits",
            ],
            [
              "Prescriptions",
              String(data.activePrescriptions),
              "Active prescriptions",
            ],
          ].map(([label, value, description]) => (
            <div key={label} className="stat-card">
              <p className="stat-label">{label}</p>

              <p className="stat-value">{value}</p>

              <p className="page-subtitle">{description}</p>
            </div>
          ))}
        </section>

        <section className="mb-6">
          <div className="mb-5">
            <p className="page-subtitle">Patient services</p>
            <h2 className="page-title text-2xl">
              Your Healthcare
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <button
                key={module.title}
                type="button"
                onClick={() => {
                  window.location.href = module.href;
                }}
                className="card text-left"
              >
                <div className="card-body">
                  <div className="flex items-start justify-between">
                    <h3 className="card-title">
                      {module.icon} {module.title}
                    </h3>

                    <span className="page-subtitle">
                      →
                    </span>
                  </div>

                  <p className="page-subtitle">
                    {module.text}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="card mb-6">
          <div className="card-header">
            <div>
              <p className="page-subtitle">Activity</p>
              <h2 className="card-title">
                Recent Consultations
              </h2>
            </div>
          </div>

          {data.recentConsultations.length === 0 ? (
            <div className="empty-state">
              <div className="text-3xl">🩺</div>

              <p className="mt-2 font-semibold">
                No consultations yet
              </p>

              <p className="mt-1">
                Your consultation history will appear here.
              </p>
            </div>
          ) : (
            <div className="card-body">
              <div className="space-y-3">
                {data.recentConsultations.map(
                  (consultation) => (
                    <div
                      key={consultation.id}
                      className="stat-card"
                    >
                      <p className="font-semibold">
                        {new Date(
                          consultation.consultation_date
                        ).toLocaleDateString("en-ZA", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>

                      <p className="page-subtitle">
                        {consultation.diagnosis ||
                          "Consultation completed"}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </section>

        <nav className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
          <div className="card">
            <div className="card-body">
              <div className="grid grid-cols-5 gap-1">
                {[
                  ["Home", "⌂", "/patient-dashboard"],
                  [
                    "Appointments",
                    "📅",
                    "/patient-dashboard/appointments",
                  ],
                  [
                    "Prescriptions",
                    "💊",
                    "/patient-dashboard/prescriptions",
                  ],
                  [
                    "Documents",
                    "📄",
                    "/patient-dashboard/documents",
                  ],
                  [
                    "Profile",
                    "👤",
                    "/patient-dashboard/profile",
                  ],
                ].map(([name, icon, href]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      if (name === "Home") {
                        setActiveTab("Home");
                      }

                      window.location.href = href;
                    }}
                    className={`btn btn-sm ${
                      activeTab === name
                        ? "btn-primary"
                        : "btn-secondary"
                    }`}
                  >
                    <span className="text-lg">
                      {icon}
                    </span>

                    <span>{name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </nav>
      </div>
    </main>
  );
}
