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
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-2xl bg-white px-8 py-6 shadow-lg">
          <p className="font-medium text-slate-600">
            Loading your healthcare information...
          </p>
        </div>
      </main>
    );
  }

  if (error || !patient) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-lg rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-xl font-bold text-slate-900">
            Patient Portal
          </h1>

          <p className="mt-4 text-slate-600">
            {error || "Your patient record could not be found."}
          </p>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white"
          >
            Back to Login
          </button>
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
    <main className="min-h-screen overflow-hidden bg-slate-100 text-slate-900">

      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-300/30 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-cyan-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-indigo-200/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-8">

        <header className="mb-6 flex items-center justify-between rounded-[2rem] border border-white/80 bg-white/50 px-5 py-4 shadow-xl backdrop-blur-2xl">

          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-blue-600">
              J&J PRACTICE CLOUD
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Welcome, {patient.first_name}
            </p>
          </div>

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="rounded-full bg-white/70 px-4 py-2 text-sm font-medium shadow-sm"
            >
              Sign out
            </button>

            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white shadow-lg">
              {getInitials(patient)}
            </div>

          </div>

        </header>

        <section className="relative mb-6 overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/45 shadow-2xl backdrop-blur-2xl">

          <div className="grid md:grid-cols-2">

            <div className="relative z-10 flex flex-col justify-center p-7 md:p-12">

              <span className="mb-4 w-fit rounded-full border border-blue-200/70 bg-blue-50/70 px-4 py-2 text-xs font-bold uppercase tracking-wider text-blue-700">
                Your healthcare, simplified
              </span>

              <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
                Hello, {patient.first_name}.
                <br />

                <span className="text-blue-600">
                  Your health.
                </span>

                <br />

                One place.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 md:text-lg">
                Manage your appointments, prescriptions, documents and
                healthcare journey from one secure patient portal.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">

                <button
                  type="button"
                  onClick={() => {
                    window.location.href =
                      "/patient-dashboard/appointments";
                  }}
                  className="rounded-2xl bg-blue-600 px-6 py-4 font-semibold text-white shadow-xl"
                >
                  Book an Appointment
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href =
                      "/patient-dashboard/profile";
                  }}
                  className="rounded-2xl border border-white bg-white/70 px-6 py-4 font-semibold text-slate-700 shadow-lg"
                >
                  View My Profile
                </button>

              </div>

            </div>

            <div className="relative min-h-[300px] overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-700 md:min-h-[430px]">

              <div className="absolute inset-0 flex items-center justify-center p-8">

                <div className="w-full max-w-sm rounded-[2rem] border border-white/30 bg-white/15 p-6 shadow-2xl backdrop-blur-xl">

                  <p className="text-sm font-medium text-white/70">
                    NEXT APPOINTMENT
                  </p>

                  <div className="mt-5 flex items-center gap-4">

                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-lg">
                      📅
                    </div>

                    <div>

                      {data.nextAppointment ? (
                        <>
                          <p className="font-bold text-white">
                            {formatDate(
                              data.nextAppointment.appointment_date
                            )}
                          </p>

                          <p className="mt-1 text-sm text-white/70">
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
                          <p className="font-bold text-white">
                            No appointment yet
                          </p>

                          <p className="mt-1 text-sm text-white/70">
                            Book your next visit
                          </p>
                        </>
                      )}

                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      window.location.href =
                        "/patient-dashboard/appointments";
                    }}
                    className="mt-6 w-full rounded-xl bg-white py-3 font-semibold text-blue-700 shadow-lg"
                  >
                    {data.nextAppointment
                      ? "View Appointments"
                      : "Book Appointment"}
                  </button>

                </div>

              </div>

            </div>

          </div>

        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">

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
            <div
              key={label}
              className="rounded-3xl border border-white/80 bg-white/55 p-5 shadow-lg backdrop-blur-2xl"
            >
              <p className="text-xs font-bold tracking-wider text-slate-400">
                {label.toUpperCase()}
              </p>

              <p className="mt-2 text-2xl font-bold">
                {value}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            </div>
          ))}

        </section>

        <section className="mb-6">

          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Patient services
            </p>

            <h2 className="mt-1 text-2xl font-bold">
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
                className="group rounded-[2rem] border border-white/80 bg-white/50 p-6 text-left shadow-lg backdrop-blur-2xl transition duration-200 hover:-translate-y-1 hover:bg-white/70 hover:shadow-2xl"
              >
                <div className="flex items-start justify-between">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 text-2xl shadow-md">
                    {module.icon}
                  </div>

                  <span className="text-xl text-slate-300">
                    →
                  </span>

                </div>

                <h3 className="mt-5 text-lg font-bold">
                  {module.title}
                </h3>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {module.text}
                </p>

              </button>
            ))}

          </div>

        </section>

        <section className="mb-24 rounded-[2rem] border border-white/80 bg-white/50 p-6 shadow-xl backdrop-blur-2xl">

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Activity
            </p>

            <h2 className="mt-1 text-xl font-bold">
              Recent Consultations
            </h2>
          </div>

          {data.recentConsultations.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-white/60 p-6 text-center">

              <div className="text-3xl">
                🩺
              </div>

              <p className="mt-2 font-semibold">
                No consultations yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Your consultation history will appear here.
              </p>

            </div>
          ) : (
            <div className="mt-5 space-y-3">

              {data.recentConsultations.map((consultation) => (
                <div
                  key={consultation.id}
                  className="rounded-2xl bg-white/70 p-5"
                >

                  <p className="font-semibold text-slate-900">
                    {new Date(
                      consultation.consultation_date
                    ).toLocaleDateString("en-ZA", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {consultation.diagnosis ||
                      "Consultation completed"}
                  </p>

                </div>
              ))}

            </div>
          )}

        </section>

        <nav className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-[2rem] border border-white/80 bg-white/75 p-2 shadow-2xl backdrop-blur-2xl">

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
                className={`rounded-2xl px-2 py-2.5 text-xs font-semibold transition ${
                  activeTab === name
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-slate-500 hover:bg-white/80"
                }`}
              >

                <div className="text-lg">
                  {icon}
                </div>

                <div className="mt-1">
                  {name}
                </div>

              </button>
            ))}

          </div>

        </nav>

      </div>

    </main>
  );
}
