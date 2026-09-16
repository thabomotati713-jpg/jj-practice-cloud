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

function getStatusStyle(status: string) {
  switch (status) {
    case "confirmed":
      return {
        background: "#ecfdf5",
        color: "#047857",
        border: "1px solid #a7f3d0",
      };

    case "completed":
      return {
        background: "#eff6ff",
        color: "#1d4ed8",
        border: "1px solid #bfdbfe",
      };

    case "cancelled":
      return {
        background: "#fef2f2",
        color: "#b91c1c",
        border: "1px solid #fecaca",
      };

    case "no_show":
      return {
        background: "#fff7ed",
        color: "#c2410c",
        border: "1px solid #fed7aa",
      };

    default:
      return {
        background: "#f8fafc",
        color: "#475569",
        border: "1px solid #cbd5e1",
      };
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
      <main className="pageShell">
        <div className="loadingCard">
          <div className="loadingIcon">📅</div>
          <h2>Loading appointments</h2>
          <p>Please wait while your appointment schedule loads.</p>
        </div>

        <style jsx>{`
          .pageShell {
            min-height: 100vh;
            padding: 28px 20px;
            background:
              radial-gradient(circle at top right, rgba(99, 102, 241, 0.1), transparent 35%),
              linear-gradient(135deg, #f8fafc, #eff6ff 55%, #eef2ff);
          }

          .loadingCard {
            max-width: 520px;
            margin: 100px auto;
            padding: 42px 30px;
            text-align: center;
            background: rgba(255, 255, 255, 0.88);
            border: 1px solid #e2e8f0;
            border-radius: 24px;
            box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
          }

          .loadingIcon {
            font-size: 42px;
            margin-bottom: 12px;
          }

          h2 {
            margin: 0 0 8px;
            color: #0f172a;
          }

          p {
            margin: 0;
            color: #64748b;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="pageShell">
      <div className="content">
        <section className="hero">
          <div>
            <div className="eyebrow">J&J PRACTICE CLOUD</div>

            <h1>Appointments</h1>

            <p>
              Manage your patient schedule, confirmations and consultation
              flow from one place.
            </p>
          </div>

          <div className="heroActions">
            <button
              className="secondaryButton"
              onClick={() => router.push("/dashboard")}
            >
              ← Dashboard
            </button>

            <button
              className="secondaryButton"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "↻ Refresh"}
            </button>

            <button
              className="primaryButton"
              onClick={() => router.push("/appointments/new")}
            >
              + New Appointment
            </button>
          </div>
        </section>

        {message && (
          <div className="message">
            <span>✓</span>
            <span>{message}</span>
          </div>
        )}

        <section className="statsGrid">
          <div className="statCard">
            <div className="statTop">
              <span className="statIcon">📋</span>
              <span className="statLabel">TOTAL</span>
            </div>
            <div className="statNumber">{totalCount}</div>
            <div className="statDescription">All appointments</div>
          </div>

          <div className="statCard todayCard">
            <div className="statTop">
              <span className="statIcon">📅</span>
              <span className="statLabel">TODAY</span>
            </div>
            <div className="statNumber">{todayCount}</div>
            <div className="statDescription">Scheduled for today</div>
          </div>

          <div className="statCard upcomingCard">
            <div className="statTop">
              <span className="statIcon">⏰</span>
              <span className="statLabel">UPCOMING</span>
            </div>
            <div className="statNumber">{upcomingCount}</div>
            <div className="statDescription">Active future visits</div>
          </div>

          <div className="statCard completedCard">
            <div className="statTop">
              <span className="statIcon">✓</span>
              <span className="statLabel">COMPLETED</span>
            </div>
            <div className="statNumber">{completedCount}</div>
            <div className="statDescription">Completed visits</div>
          </div>

          <div className="statCard cancelledCard">
            <div className="statTop">
              <span className="statIcon">×</span>
              <span className="statLabel">CANCELLED</span>
            </div>
            <div className="statNumber">{cancelledCount}</div>
            <div className="statDescription">Cancelled visits</div>
          </div>
        </section>

        <section className="filterCard">
          <div className="filterHeader">
            <div>
              <h2>Appointment Schedule</h2>
              <p>
                Search and filter appointments by patient, date or status.
              </p>
            </div>

            <div className="resultCount">
              {filteredAppointments.length} of {appointments.length}
            </div>
          </div>

          <div className="filters">
            <div className="searchWrapper">
              <label>Search</label>
              <div className="searchBox">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder="Patient, ID, phone, email, type or reason..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div>
              <label>Date</label>
              <select
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
              >
                <option value="all">All dates</option>
                <option value="today">Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
            </div>

            <div>
              <label>Status</label>
              <select
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

            <div className="clearContainer">
              <label>&nbsp;</label>
              <button className="clearButton" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          </div>
        </section>

        {filteredAppointments.length === 0 ? (
          <section className="emptyCard">
            <div className="emptyIcon">📅</div>
            <h2>No appointments found</h2>
            <p>
              Try changing your filters or create a new appointment.
            </p>

            <div className="emptyActions">
              <button className="secondaryButton" onClick={clearFilters}>
                Clear filters
              </button>

              <button
                className="primaryButton"
                onClick={() => router.push("/appointments/new")}
              >
                + New Appointment
              </button>
            </div>
          </section>
        ) : (
          <section className="tableCard">
            <div className="tableHeader">
              <div>
                <h2>Scheduled Visits</h2>
                <p>
                  Showing {filteredAppointments.length} appointment
                  {filteredAppointments.length === 1 ? "" : "s"}.
                </p>
              </div>
            </div>

            <div className="tableScroll">
              <table>
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>TIME</th>
                    <th>PATIENT</th>
                    <th>CONTACT</th>
                    <th>TYPE</th>
                    <th>REASON</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
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
                          <div className="dateCell">
                            <strong>
                              {formatDate(appointment.appointment_date)}
                            </strong>

                            {isToday && (
                              <span className="todayPill">TODAY</span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="timeCell">
                            <span>◷</span>
                            <strong>
                              {formatTime(appointment.start_time)} –{" "}
                              {formatTime(appointment.end_time)}
                            </strong>
                          </div>
                        </td>

                        <td>
                          <div className="patientCell">
                            <div className="patientAvatar">
                              {patient?.first_name?.charAt(0) || "?"}
                            </div>

                            <div>
                              <strong>{patientName}</strong>
                              <small>
                                {patient?.patient_id || "No Patient ID"}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="contactCell">
                            <span>{patient?.phone || "No phone"}</span>
                            <small>
                              {patient?.email || "No email"}
                            </small>
                          </div>
                        </td>

                        <td>
                          <span className="typePill">
                            {appointment.appointment_type || "General"}
                          </span>
                        </td>

                        <td>
                          <div className="reasonCell">
                            <span>{appointment.reason || "—"}</span>

                            {appointment.notes && (
                              <small>Notes: {appointment.notes}</small>
                            )}
                          </div>
                        </td>

                        <td>
                          <select
                            className="statusSelect"
                            value={status}
                            onChange={(event) =>
                              updateStatus(
                                appointment.id,
                                event.target.value
                              )
                            }
                            style={getStatusStyle(status)}
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
                          <div className="actions">
                            <button
                              className="actionButton"
                              onClick={() =>
                                router.push(
                                  `/appointments/${appointment.id}/edit`
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="actionButton"
                              onClick={() =>
                                router.push(
                                  `/patients/${appointment.patient_id}`
                                )
                              }
                            >
                              Patient
                            </button>

                            <button
                              className="emailButton"
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
                                className="consultButton"
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
                                className="consultButton"
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
                                  className="cancelButton"
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

      <style jsx>{`
        .pageShell {
          min-height: 100vh;
          padding: 28px 20px 50px;
          background:
            radial-gradient(circle at 85% 0%, rgba(99, 102, 241, 0.1), transparent 30%),
            radial-gradient(circle at 0% 30%, rgba(59, 130, 246, 0.07), transparent 28%),
            linear-gradient(135deg, #f8fafc 0%, #eff6ff 52%, #eef2ff 100%);
        }

        .content {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          padding: 28px;
          margin-bottom: 20px;
          border: 1px solid rgba(226, 232, 240, 0.9);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.86);
          box-shadow: 0 16px 45px rgba(15, 23, 42, 0.07);
          backdrop-filter: blur(18px);
        }

        .eyebrow {
          margin-bottom: 8px;
          color: #4f46e5;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.14em;
        }

        h1 {
          margin: 0 0 7px;
          color: #0f172a;
          font-size: clamp(30px, 4vw, 42px);
          line-height: 1.05;
          letter-spacing: -0.03em;
        }

        .hero p {
          margin: 0;
          color: #64748b;
          font-size: 15px;
        }

        .heroActions,
        .emptyActions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        button {
          font: inherit;
        }

        .primaryButton,
        .secondaryButton,
        .clearButton {
          border-radius: 12px;
          padding: 11px 15px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .primaryButton {
          border: 1px solid #4f46e5;
          background: #4f46e5;
          color: white;
          box-shadow: 0 5px 14px rgba(79, 70, 229, 0.2);
        }

        .primaryButton:hover {
          background: #4338ca;
          transform: translateY(-1px);
        }

        .secondaryButton {
          border: 1px solid #dbe2ea;
          background: white;
          color: #334155;
        }

        .secondaryButton:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .secondaryButton:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .message {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 20px;
          padding: 13px 16px;
          border: 1px solid #bfdbfe;
          border-radius: 14px;
          background: #eff6ff;
          color: #1e40af;
          font-size: 14px;
          font-weight: 600;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .statCard {
          position: relative;
          overflow: hidden;
          min-height: 145px;
          padding: 20px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.055);
        }

        .statCard::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 3px;
          background: #6366f1;
        }

        .todayCard::after {
          background: #2563eb;
        }

        .upcomingCard::after {
          background: #f59e0b;
        }

        .completedCard::after {
          background: #059669;
        }

        .cancelledCard::after {
          background: #dc2626;
        }

        .statTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .statIcon {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: #eef2ff;
          font-size: 17px;
        }

        .statLabel {
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .statNumber {
          margin-top: 16px;
          color: #0f172a;
          font-size: 32px;
          font-weight: 800;
          line-height: 1;
        }

        .statDescription {
          margin-top: 8px;
          color: #94a3b8;
          font-size: 13px;
        }

        .filterCard,
        .tableCard,
        .emptyCard {
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 12px 35px rgba(15, 23, 42, 0.06);
        }

        .filterCard {
          margin-bottom: 20px;
          padding: 22px;
        }

        .filterHeader,
        .tableHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 18px;
        }

        .filterHeader h2,
        .tableHeader h2,
        .emptyCard h2 {
          margin: 0 0 5px;
          color: #0f172a;
          font-size: 18px;
        }

        .filterHeader p,
        .tableHeader p,
        .emptyCard p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
        }

        .resultCount {
          padding: 8px 11px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        .filters {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 190px 190px auto;
          gap: 12px;
          align-items: end;
        }

        label {
          display: block;
          margin-bottom: 7px;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        input,
        select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe2ea;
          border-radius: 11px;
          background: white;
          color: #1e293b;
          font: inherit;
          font-size: 14px;
          outline: none;
          transition: 0.18s ease;
        }

        input {
          padding: 11px 12px;
        }

        select {
          padding: 11px 12px;
          cursor: pointer;
        }

        input:focus,
        select:focus {
          border-color: #818cf8;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .searchBox {
          position: relative;
        }

        .searchBox > span {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-51%);
          color: #94a3b8;
          font-size: 20px;
          pointer-events: none;
        }

        .searchBox input {
          padding-left: 36px;
        }

        .clearButton {
          border: 1px solid #dbe2ea;
          background: #f8fafc;
          color: #475569;
        }

        .clearButton:hover {
          background: #f1f5f9;
        }

        .emptyCard {
          padding: 55px 25px;
          text-align: center;
        }

        .emptyIcon {
          margin-bottom: 14px;
          font-size: 46px;
          opacity: 0.8;
        }

        .emptyActions {
          justify-content: center;
          margin-top: 22px;
        }

        .tableHeader {
          padding: 20px 22px 0;
          margin-bottom: 18px;
        }

        .tableScroll {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1450px;
          border-collapse: separate;
          border-spacing: 0;
        }

        th {
          padding: 13px 15px;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-align: left;
          white-space: nowrap;
        }

        td {
          padding: 16px 15px;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr {
          transition: background 0.15s ease;
        }

        tbody tr:hover {
          background: #f8fbff;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        td strong {
          color: #0f172a;
        }

        small {
          display: block;
          margin-top: 4px;
          color: #94a3b8;
          font-size: 11px;
        }

        .dateCell {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 100px;
        }

        .todayPill {
          width: fit-content;
          padding: 3px 7px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.06em;
        }

        .timeCell {
          display: flex;
          align-items: center;
          gap: 7px;
          min-width: 135px;
          color: #334155;
        }

        .timeCell > span {
          color: #6366f1;
          font-size: 17px;
        }

        .patientCell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 190px;
        }

        .patientAvatar {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 14px;
          font-weight: 800;
        }

        .patientCell strong {
          display: block;
          font-size: 13px;
        }

        .contactCell {
          min-width: 175px;
        }

        .contactCell span,
        .contactCell small {
          white-space: nowrap;
        }

        .typePill {
          display: inline-block;
          max-width: 140px;
          padding: 6px 9px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          color: #475569;
          font-size: 11px;
          font-weight: 700;
        }

        .reasonCell {
          min-width: 170px;
          max-width: 230px;
        }

        .reasonCell > span,
        .reasonCell small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .statusSelect {
          width: auto;
          min-width: 120px;
          padding: 7px 28px 7px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          min-width: 310px;
        }

        .actionButton,
        .emailButton,
        .consultButton,
        .cancelButton {
          border-radius: 8px;
          padding: 7px 9px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.16s ease;
          white-space: nowrap;
        }

        .actionButton {
          border: 1px solid #dbe2ea;
          background: white;
          color: #475569;
        }

        .actionButton:hover {
          background: #f8fafc;
        }

        .emailButton {
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .emailButton:hover:not(:disabled) {
          background: #dbeafe;
        }

        .emailButton:disabled {
          border-color: #e2e8f0;
          background: #f1f5f9;
          color: #94a3b8;
          cursor: not-allowed;
        }

        .consultButton {
          border: 1px solid #059669;
          background: #059669;
          color: white;
        }

        .consultButton:hover {
          background: #047857;
        }

        .cancelButton {
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #dc2626;
        }

        .cancelButton:hover {
          background: #ffe4e6;
        }

        @media (max-width: 1100px) {
          .statsGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .filters {
            grid-template-columns: 1fr 1fr;
          }

          .searchWrapper {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 760px) {
          .pageShell {
            padding: 15px 10px 35px;
          }

          .hero {
            align-items: flex-start;
            flex-direction: column;
            padding: 21px;
          }

          .heroActions {
            width: 100%;
          }

          .heroActions button {
            flex: 1;
          }

          .statsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .filterCard {
            padding: 17px;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .searchWrapper {
            grid-column: auto;
          }

          .clearContainer {
            width: 100%;
          }

          .clearButton {
            width: 100%;
          }

          .filterHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .tableCard {
            border-radius: 18px;
          }
        }

        @media (max-width: 480px) {
          .statsGrid {
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .statCard {
            min-height: 125px;
            padding: 15px;
          }

          .statNumber {
            font-size: 27px;
          }

          .statDescription {
            font-size: 11px;
          }

          .heroActions {
            flex-direction: column;
          }

          .heroActions button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
