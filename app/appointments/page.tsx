"use client";

import { useEffect, useMemo, useState } from "react";
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

type Appointment = {
  id: string;
  patient_id: string;
  provider_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_type: string | null;
  reason: string | null;
  status: string | null;
  notes: string | null;
  reminder_sent: boolean | null;
};

const statuses = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

function formatTime(time: string) {
  if (!time) return "";
  return time.slice(0, 5);
}

function formatDate(date: string) {
  if (!date) return "";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getPatientName(patient?: Patient) {
  if (!patient) return "Unknown patient";

  return `${patient.first_name} ${patient.middle_name || ""} ${patient.last_name}`
    .replace(/\s+/g, " ")
    .trim();
}

function getStatusLabel(status: string | null) {
  return (status || "scheduled")
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "confirmed":
      return "badge badge-blue";
    case "completed":
      return "badge badge-green";
    case "cancelled":
      return "badge badge-red";
    case "no_show":
      return "badge badge-amber";
    default:
      return "badge badge-gray";
  }
}

export default function AppointmentsPage() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setMessage("");

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

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!profile?.practice_id) {
      setMessage("Your profile is not linked to a practice.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [
      { data: appointmentData, error: appointmentError },
      { data: patientData, error: patientError },
    ] = await Promise.all([
      supabase
        .from("appointments")
        .select("*")
        .eq("practice_id", profile.practice_id)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true }),

      supabase
        .from("patients")
        .select(
          "id, patient_id, first_name, middle_name, last_name, phone, email"
        )
        .eq("practice_id", profile.practice_id)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true }),
    ]);

    if (appointmentError) {
      setMessage(appointmentError.message);
    } else {
      setAppointments(appointmentData || []);
    }

    if (patientError) {
      setMessage(patientError.message);
    } else {
      setPatients(patientData || []);
    }

    setLoading(false);
    setRefreshing(false);
  }

  const patientMap = useMemo(() => {
    const map: Record<string, Patient> = {};

    for (const patient of patients) {
      map[patient.id] = patient;
    }

    return map;
  }, [patients]);

  const todayString = useMemo(() => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }, []);

  const filteredAppointments = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return appointments.filter((appointment) => {
      const patient = patientMap[appointment.patient_id];
      const patientName = getPatientName(patient);

      const matchesSearch =
        !searchText ||
        patientName.toLowerCase().includes(searchText) ||
        (patient?.patient_id || "").toLowerCase().includes(searchText) ||
        (patient?.phone || "").toLowerCase().includes(searchText) ||
        (patient?.email || "").toLowerCase().includes(searchText) ||
        (appointment.reason || "").toLowerCase().includes(searchText) ||
        (appointment.appointment_type || "")
          .toLowerCase()
          .includes(searchText);

      const matchesStatus =
        statusFilter === "all" ||
        (appointment.status || "scheduled").toLowerCase() === statusFilter;

      let matchesDate = true;

      if (dateFilter === "today") {
        matchesDate = appointment.appointment_date === todayString;
      }

      if (dateFilter === "upcoming") {
        matchesDate =
          appointment.appointment_date >= todayString &&
          appointment.status !== "cancelled" &&
          appointment.status !== "completed";
      }

      if (dateFilter === "past") {
        matchesDate = appointment.appointment_date < todayString;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [
    appointments,
    patientMap,
    search,
    statusFilter,
    dateFilter,
    todayString,
  ]);

  const totalCount = appointments.length;

  const todayCount = appointments.filter(
    (appointment) => appointment.appointment_date === todayString
  ).length;

  const upcomingCount = appointments.filter(
    (appointment) =>
      appointment.appointment_date >= todayString &&
      appointment.status !== "cancelled" &&
      appointment.status !== "completed"
  ).length;

  const completedCount = appointments.filter(
    (appointment) => appointment.status === "completed"
  ).length;

  const cancelledCount = appointments.filter(
    (appointment) => appointment.status === "cancelled"
  ).length;

  async function updateStatus(id: string, status: string) {
    setMessage("");

    const { error } = await supabase
      .from("appointments")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setAppointments((current) =>
      current.map((appointment) =>
        appointment.id === id
          ? { ...appointment, status }
          : appointment
      )
    );

    setMessage("Appointment status updated.");
  }

  async function sendConfirmation(appointmentId: string) {
    setMessage("");

    try {
      const response = await fetch(
        "/api/appointments/send-confirmation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            appointmentId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          result.error || "Could not send appointment confirmation."
        );
        return;
      }

      setMessage(
        result.message || "Appointment confirmation sent successfully."
      );
    } catch {
      setMessage("Could not send appointment confirmation.");
    }
  }

  async function cancelAppointment(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this appointment?"
    );

    if (!confirmed) return;

    await updateStatus(id, "cancelled");
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setDateFilter("all");
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
          <div className="card">
            <div className="empty-state">
              <p>Loading appointments…</p>
              <p>Please wait while your appointment schedule loads.</p>
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

          <div className="page-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => router.push("/dashboard")}
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Appointments</h1>
            <p className="page-subtitle">
              Manage your patient schedule, confirmations and consultation
              flow from one place.
            </p>
          </div>

          <div className="page-actions">
            <button
              className="btn btn-secondary"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "↻ Refresh"}
            </button>

            <button
              className="btn btn-primary"
              onClick={() => router.push("/appointments/new")}
            >
              + New Appointment
            </button>
          </div>
        </div>

        {message && <div className="alert-info">{message}</div>}

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Total</div>
            <div className="stat-value">{totalCount}</div>
            <p className="page-subtitle">All appointments</p>
          </div>

          <div className="stat-card">
            <div className="stat-label">Today</div>
            <div className="stat-value">{todayCount}</div>
            <p className="page-subtitle">Scheduled for today</p>
          </div>

          <div className="stat-card">
            <div className="stat-label">Upcoming</div>
            <div className="stat-value">{upcomingCount}</div>
            <p className="page-subtitle">Active future visits</p>
          </div>

          <div className="stat-card">
            <div className="stat-label">Completed</div>
            <div className="stat-value">{completedCount}</div>
            <p className="page-subtitle">Completed visits</p>
          </div>

          <div className="stat-card">
            <div className="stat-label">Cancelled</div>
            <div className="stat-value">{cancelledCount}</div>
            <p className="page-subtitle">Cancelled visits</p>
          </div>
        </div>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Appointment Schedule</h2>
              <p className="page-subtitle">
                Search and filter appointments by patient, date or status.
              </p>
            </div>

            <span className="badge badge-gray">
              {filteredAppointments.length} of {appointments.length}
            </span>
          </div>

          <div className="card-body">
            <div className="field">
              <label className="label" htmlFor="appointment-search">
                Search
              </label>
              <input
                id="appointment-search"
                className="input"
                type="text"
                placeholder="Patient, ID, phone, email, type or reason..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="date-filter">
                Date
              </label>
              <select
                id="date-filter"
                className="input"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
              >
                <option value="all">All dates</option>
                <option value="today">Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor="status-filter">
                Status
              </label>
              <select
                id="status-filter"
                className="input"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>

                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <button className="btn btn-secondary" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        </section>

        {filteredAppointments.length === 0 ? (
          <section className="card">
            <div className="empty-state">
              <p>No appointments found</p>
              <p>Try changing your filters or create a new appointment.</p>

              <div className="page-actions justify-center mt-4">
                <button className="btn btn-secondary" onClick={clearFilters}>
                  Clear filters
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/appointments/new")}
                >
                  + New Appointment
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Scheduled Visits</h2>
                <p className="page-subtitle">
                  Showing {filteredAppointments.length} appointment
                  {filteredAppointments.length === 1 ? "" : "s"}.
                </p>
              </div>
            </div>

            <div className="table-wrap border-0 rounded-none shadow-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Patient</th>
                    <th>Contact</th>
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAppointments.map((appointment) => {
                    const patient = patientMap[appointment.patient_id];
                    const patientName = getPatientName(patient);
                    const status = appointment.status || "scheduled";

                    const isToday =
                      appointment.appointment_date === todayString;

                    const canStartConsultation =
                      status !== "cancelled" &&
                      status !== "completed";

                    return (
                      <tr key={appointment.id}>
                        <td>
                          <strong>{formatDate(appointment.appointment_date)}</strong>

                          {isToday && (
                            <>
                              <br />
                              <span className="badge badge-blue">TODAY</span>
                            </>
                          )}
                        </td>

                        <td>
                          {formatTime(appointment.start_time)} –{" "}
                          {formatTime(appointment.end_time)}
                        </td>

                        <td>
                          <strong>{patientName}</strong>
                          <br />
                          <small className="text-muted">
                            {patient?.patient_id || "No Patient ID"}
                          </small>
                        </td>

                        <td>
                          {patient?.phone || "No phone"}
                          <br />
                          <small className="text-muted">
                            {patient?.email || "No email"}
                          </small>
                        </td>

                        <td>
                          <span className="badge badge-gray">
                            {appointment.appointment_type || "General"}
                          </span>
                        </td>

                        <td>
                          {appointment.reason || "—"}

                          {appointment.notes && (
                            <>
                              <br />
                              <small className="text-muted">
                                Notes: {appointment.notes}
                              </small>
                            </>
                          )}
                        </td>

                        <td>
                          <select
                            className={`${getStatusBadgeClass(status)} cursor-pointer`}
                            value={status}
                            onChange={(event) =>
                              updateStatus(
                                appointment.id,
                                event.target.value
                              )
                            }
                          >
                            {statuses.map((statusOption) => (
                              <option
                                key={statusOption}
                                value={statusOption}
                              >
                                {getStatusLabel(statusOption)}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          <div className="page-actions">
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                router.push(
                                  `/appointments/${appointment.id}/edit`
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                router.push(
                                  `/patients/${appointment.patient_id}`
                                )
                              }
                            >
                              Patient
                            </button>

                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                sendConfirmation(appointment.id)
                              }
                              disabled={
                                !patient?.email ||
                                status === "cancelled" ||
                                status === "completed"
                              }
                            >
                              ✉ Confirmation
                            </button>

                            {canStartConsultation && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() =>
                                  router.push(
                                    `/consult/${appointment.id}`
                                  )
                                }
                              >
                                🎥 Video
                              </button>
                            )}

                            {canStartConsultation && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() =>
                                  router.push(
                                    `/patients/${appointment.patient_id}/consultations/new?appointment_id=${appointment.id}`
                                  )
                                }
                              >
                                Start Consultation
                              </button>
                            )}

                            {status !== "cancelled" &&
                              status !== "completed" && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() =>
                                    cancelAppointment(appointment.id)
                                  }
                                >
                                  Cancel
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
