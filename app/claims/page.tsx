"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Claim = {
  id: string;
  patient_id: string;
  invoice_id: string | null;
  claim_number: string | null;
  claim_date: string | null;
  medical_aid_provider: string | null;
  membership_number: string | null;
  dependent_code: string | null;
  main_member_name: string | null;
  claimed_amount: number | null;
  approved_amount: number | null;
  rejected_amount: number | null;
  submission_date: string | null;
  response_date: string | null;
  status: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
};

type Patient = {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
};

export default function ClaimsPage() {
  const router = useRouter();

  const [claims, setClaims] = useState<Claim[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [{ data: claimData, error: claimError }, { data: patientData, error: patientError }] =
      await Promise.all([
        supabase
          .from("medical_aid_claims")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("patients")
          .select("id, patient_id, first_name, last_name")
          .order("last_name", { ascending: true }),
      ]);

    if (claimError) {
      console.error("Error loading claims:", claimError);
    }

    if (patientError) {
      console.error("Error loading patients:", patientError);
    }

    setClaims(claimData || []);
    setPatients(patientData || []);
    setLoading(false);
  }

  function getPatient(patientId: string) {
    return patients.find((patient) => patient.id === patientId);
  }

  function formatCurrency(value: number | null) {
    return `R ${(value || 0).toFixed(2)}`;
  }

  function formatDate(value: string | null) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }

  function statusLabel(status: string | null) {
    if (!status) return "Unknown";

    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function statusBadgeClass(status: string | null) {
    const value = (status || "").toLowerCase();

    if (
      value === "paid" ||
      value === "completed" ||
      value === "approved" ||
      value === "active"
    ) {
      return "badge badge-green";
    }

    if (
      value === "pending" ||
      value === "submitted" ||
      value === "partially paid" ||
      value === "partially_approved" ||
      value === "partially approved" ||
      value === "scheduled" ||
      value === "confirmed"
    ) {
      return "badge badge-blue";
    }

    if (value === "low stock" || value === "no show") {
      return "badge badge-amber";
    }

    if (
      value === "cancelled" ||
      value === "rejected" ||
      value === "overdue" ||
      value === "out of stock"
    ) {
      return "badge badge-red";
    }

    return "badge badge-gray";
  }

  const filteredClaims = claims.filter((claim) => {
    const patient = getPatient(claim.patient_id);

    const searchText = [
      claim.claim_number,
      claim.medical_aid_provider,
      claim.membership_number,
      claim.main_member_name,
      patient?.patient_id,
      patient?.first_name,
      patient?.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchText.includes(search.toLowerCase());
  });

  const totalClaimed = claims.reduce(
    (sum, claim) => sum + Number(claim.claimed_amount || 0),
    0
  );

  const totalApproved = claims.reduce(
    (sum, claim) => sum + Number(claim.approved_amount || 0),
    0
  );

  const totalRejected = claims.reduce(
    (sum, claim) => sum + Number(claim.rejected_amount || 0),
    0
  );

  const pendingClaims = claims.filter(
    (claim) =>
      claim.status?.toLowerCase() === "pending" ||
      claim.status?.toLowerCase() === "submitted"
  ).length;

  return (
    <main className="page-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <a href="/dashboard" className="app-brand">
            <img src="/logo.jpg" alt="J&J Practice Cloud" className="app-brand-logo" />
            <span className="app-brand-name">J&J Practice Cloud</span>
          </a>

          <div className="page-actions">
            <button
              onClick={() => router.push("/dashboard")}
              className="btn btn-secondary btn-sm"
            >
              ← Back to Dashboard
            </button>

            <button
              onClick={() => router.push("/claims/new")}
              className="btn btn-primary btn-sm"
            >
              + New Claim
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Medical Aid Claims</h1>
            <p className="page-subtitle">Manage and track medical aid claims.</p>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Total Claims</div>
            <div className="stat-value">{claims.length}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Total Claimed</div>
            <div className="stat-value">{formatCurrency(totalClaimed)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Total Approved</div>
            <div className="stat-value">{formatCurrency(totalApproved)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Total Rejected</div>
            <div className="stat-value">{formatCurrency(totalRejected)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Pending / Submitted</div>
            <div className="stat-value">{pendingClaims}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <input
              type="text"
              placeholder="Search by patient, claim number, medical aid or membership number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading claims...</div>
        ) : filteredClaims.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <h3 className="card-title">No medical aid claims found</h3>
              <p>
                {search
                  ? "Try a different search."
                  : "Create your first medical aid claim."}
              </p>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Claim Number</th>
                  <th>Patient</th>
                  <th>Medical Aid</th>
                  <th>Membership</th>
                  <th>Claim Date</th>
                  <th>Claimed</th>
                  <th>Approved</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredClaims.map((claim) => {
                  const patient = getPatient(claim.patient_id);

                  return (
                    <tr key={claim.id}>
                      <td>
                        <strong>
                          {claim.claim_number || "Not assigned"}
                        </strong>
                      </td>

                      <td>
                        {patient ? (
                          <div>
                            <strong>
                              {patient.first_name} {patient.last_name}
                            </strong>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {patient.patient_id}
                            </div>
                          </div>
                        ) : (
                          "Unknown patient"
                        )}
                      </td>

                      <td>{claim.medical_aid_provider || "-"}</td>

                      <td>{claim.membership_number || "-"}</td>

                      <td>{formatDate(claim.claim_date)}</td>

                      <td>{formatCurrency(claim.claimed_amount)}</td>

                      <td>{formatCurrency(claim.approved_amount)}</td>

                      <td>
                        <span className={statusBadgeClass(claim.status)}>
                          {statusLabel(claim.status)}
                        </span>
                      </td>

                      <td>
                        <button
                          onClick={() => router.push(`/claims/${claim.id}`)}
                          className="btn btn-secondary btn-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
