"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { usePracticeList } from "../../lib/usePracticeList";
import ListPagination from "../../components/ListPagination";

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
  patient: Patient;
};

type Patient = {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
};

export default function ClaimsPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const {
    rows: claims,
    total,
    summary,
    loading,
    error,
    refresh,
  } = usePracticeList<Claim>("pc_claims_page", search, page);
  useEffect(() => {
    if (!loading && !error)
      void logAudit("view", "claim", null, "Claims list viewed");
  }, [loading, error]);

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
      value === "accepted" ||
      value === "active"
    ) {
      return "badge badge-green";
    }

    if (
      value === "draft" ||
      value === "ready" ||
      value === "submitted" ||
      value === "partially paid" ||
      value === "partially_paid" ||
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

  const filteredClaims = claims;
  const totalClaimed = summary.claimed || 0;
  const totalApproved = summary.approved || 0;
  const totalRejected = summary.rejected || 0;
  const pendingClaims = summary.pending || 0;

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
              type="button"
              onClick={() => router.push("/claims-demo")}
              className="btn btn-secondary btn-sm"
            >
              Interactive sample
            </button>
            <button
              type="button"
              onClick={() => router.push("/claims/settings")}
              className="btn btn-secondary btn-sm"
            >
              Claim automation settings
            </button>
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
            <p className="page-subtitle">
              Manage and track medical aid claims.
            </p>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Total Claims</div>
            <div className="stat-value">{summary.count || 0}</div>
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
              maxLength={200}
              aria-label="Search all claims"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="input"
            />
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-3">
          Financial totals cover all claims in your practice.
        </p>
        {error && (
          <div className="alert-error" role="alert">
            {error}{" "}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={refresh}
            >
              Retry
            </button>
          </div>
        )}
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
                  const patient = claim.patient;

                  return (
                    <tr key={claim.id}>
                      <td>
                        <strong>{claim.claim_number || "Not assigned"}</strong>
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
        <ListPagination
          page={page}
          total={total}
          loading={loading}
          onChange={setPage}
        />
      </div>
    </main>
  );
}
