"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PracticeAccessGuard from "../../components/PracticeAccessGuard";

type Patient = {
  id: string;
  patient_id: string;
  title: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
};

function statusBadgeClass(status: string | null): string {
  const value = (status || "").toLowerCase();
  if (["paid", "completed", "active", "in stock"].includes(value)) {
    return "badge badge-green";
  }
  if (
    ["pending", "submitted", "partially paid", "scheduled", "confirmed"].includes(
      value
    )
  ) {
    return "badge badge-blue";
  }
  if (["low stock", "no show"].includes(value)) {
    return "badge badge-amber";
  }
  if (["cancelled", "rejected", "overdue", "out of stock"].includes(value)) {
    return "badge badge-red";
  }
  return "badge badge-gray";
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    setError("");

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      window.location.href = "/";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      setError("Your practice profile could not be found.");
      setLoading(false);
      return;
    }

    const { data, error: patientsError } = await supabase
      .from("patients")
      .select(
        "id, patient_id, title, first_name, middle_name, last_name, date_of_birth, gender, phone, email, status"
      )
      .eq("practice_id", profile.practice_id)
      .order("created_at", { ascending: false });

    if (patientsError) {
      setError(patientsError.message);
    } else {
      setPatients((data || []) as Patient[]);
    }

    setLoading(false);
  };

  const filteredPatients = patients.filter((patient) => {
    const text = [
      patient.patient_id,
      patient.first_name,
      patient.middle_name,
      patient.last_name,
      patient.phone,
      patient.email,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <PracticeAccessGuard>
    <main className="page-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <a href="/dashboard" className="app-brand">
            <img src="/logo.jpg" alt="J&J Practice Cloud" className="app-brand-logo" />
            <span className="app-brand-name">J&J Practice Cloud</span>
          </a>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="btn btn-secondary btn-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="page-inner">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Patients</h1>

            <p className="page-subtitle">Manage your practice patients</p>
          </div>

          <div className="page-actions">
            <button
              onClick={() => {
                window.location.href = "/dashboard";
              }}
              className="btn btn-secondary btn-sm"
            >
              ← Dashboard
            </button>

            <button
              onClick={() => {
                window.location.href = "/patients/new";
              }}
              className="btn btn-primary"
            >
              + Add Patient
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="card">
          <div className="card-body">
            <div className="field">
              <label htmlFor="patient-search" className="label">
                Search patients
              </label>

              <input
                id="patient-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by patient ID, name, phone or email..."
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && <div className="alert-error">{error}</div>}

        {/* Patient Table */}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Patient ID</th>

                <th>Name</th>

                <th>Date of Birth</th>

                <th>Gender</th>

                <th>Phone</th>

                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    Loading patients...
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    {search
                      ? "No patients match your search."
                      : "No patients found."}
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.id}>
                    <td>
                      <button
                        onClick={() => {
                          window.location.href = `/patients/${patient.id}`;
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        {patient.patient_id}
                      </button>
                    </td>

                    <td>
                      {[
                        patient.title,
                        patient.first_name,
                        patient.middle_name,
                        patient.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </td>

                    <td>{patient.date_of_birth || "—"}</td>

                    <td>{patient.gender || "—"}</td>

                    <td>{patient.phone || "—"}</td>

                    <td>
                      <span className={statusBadgeClass(patient.status)}>
                        {patient.status || "active"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
    </PracticeAccessGuard>
  );
}
