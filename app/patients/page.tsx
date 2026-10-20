"use client";

import { useState } from "react";
import Link from "next/link";
import { usePracticeList } from "../../lib/usePracticeList";
import ListPagination from "../../components/ListPagination";
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const { rows: filteredPatients, total, loading, error, refresh } = usePracticeList<Patient>("pc_patients_page", search, page);

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
              window.location.href = "/login";
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
                maxLength={200}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search by patient ID, name, phone or email..."
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && <div className="alert-error" role="alert">{error} <button type="button" onClick={refresh} className="btn btn-secondary btn-sm">Retry</button></div>}

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
                      <Link href={`/patients/${patient.id}`} className="btn btn-secondary btn-sm">
                        {patient.patient_id}
                      </Link>
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
        <ListPagination page={page} total={total} loading={loading} onChange={setPage} />
      </div>
    </main>
    </PracticeAccessGuard>
  );
}
