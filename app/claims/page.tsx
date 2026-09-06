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
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "30px",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            marginBottom: "30px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <button
              onClick={() => router.push("/dashboard")}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                marginBottom: "10px",
                color: "#555",
              }}
            >
              ← Back to Dashboard
            </button>

            <h1
              style={{
                margin: 0,
                fontSize: "32px",
                color: "#1f2937",
              }}
            >
              Medical Aid Claims
            </h1>

            <p
              style={{
                marginTop: "8px",
                color: "#6b7280",
              }}
            >
              Manage and track medical aid claims.
            </p>
          </div>

          <button
            onClick={() => router.push("/claims/new")}
            style={{
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "12px 20px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + New Claim
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "25px",
          }}
        >
          <div style={cardStyle}>
            <div style={cardTitleStyle}>Total Claims</div>
            <div style={cardValueStyle}>{claims.length}</div>
          </div>

          <div style={cardStyle}>
            <div style={cardTitleStyle}>Total Claimed</div>
            <div style={cardValueStyle}>{formatCurrency(totalClaimed)}</div>
          </div>

          <div style={cardStyle}>
            <div style={cardTitleStyle}>Total Approved</div>
            <div style={cardValueStyle}>{formatCurrency(totalApproved)}</div>
          </div>

          <div style={cardStyle}>
            <div style={cardTitleStyle}>Total Rejected</div>
            <div style={cardValueStyle}>{formatCurrency(totalRejected)}</div>
          </div>

          <div style={cardStyle}>
            <div style={cardTitleStyle}>Pending / Submitted</div>
            <div style={cardValueStyle}>{pendingClaims}</div>
          </div>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <input
              type="text"
              placeholder="Search by patient, claim number, medical aid or membership number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px 15px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "15px",
              }}
            />
          </div>

          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "50px",
                color: "#6b7280",
              }}
            >
              Loading claims...
            </div>
          ) : filteredClaims.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "50px",
                color: "#6b7280",
              }}
            >
              <h3 style={{ color: "#374151" }}>No medical aid claims found</h3>
              <p>
                {search
                  ? "Try a different search."
                  : "Create your first medical aid claim."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "1000px",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                    <th style={thStyle}>Claim Number</th>
                    <th style={thStyle}>Patient</th>
                    <th style={thStyle}>Medical Aid</th>
                    <th style={thStyle}>Membership</th>
                    <th style={thStyle}>Claim Date</th>
                    <th style={thStyle}>Claimed</th>
                    <th style={thStyle}>Approved</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredClaims.map((claim) => {
                    const patient = getPatient(claim.patient_id);

                    return (
                      <tr
                        key={claim.id}
                        style={{
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        <td style={tdStyle}>
                          <strong>
                            {claim.claim_number || "Not assigned"}
                          </strong>
                        </td>

                        <td style={tdStyle}>
                          {patient ? (
                            <div>
                              <strong>
                                {patient.first_name} {patient.last_name}
                              </strong>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#6b7280",
                                  marginTop: "3px",
                                }}
                              >
                                {patient.patient_id}
                              </div>
                            </div>
                          ) : (
                            "Unknown patient"
                          )}
                        </td>

                        <td style={tdStyle}>
                          {claim.medical_aid_provider || "-"}
                        </td>

                        <td style={tdStyle}>
                          {claim.membership_number || "-"}
                        </td>

                        <td style={tdStyle}>
                          {formatDate(claim.claim_date)}
                        </td>

                        <td style={tdStyle}>
                          {formatCurrency(claim.claimed_amount)}
                        </td>

                        <td style={tdStyle}>
                          {formatCurrency(claim.approved_amount)}
                        </td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "5px 10px",
                              borderRadius: "20px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background:
                                claim.status?.toLowerCase() === "approved"
                                  ? "#dcfce7"
                                  : claim.status?.toLowerCase() === "rejected"
                                  ? "#fee2e2"
                                  : "#fef3c7",
                              color:
                                claim.status?.toLowerCase() === "approved"
                                  ? "#166534"
                                  : claim.status?.toLowerCase() === "rejected"
                                  ? "#991b1b"
                                  : "#92400e",
                            }}
                          >
                            {statusLabel(claim.status)}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <button
                            onClick={() => router.push(`/claims/${claim.id}`)}
                            style={{
                              border: "1px solid #2563eb",
                              color: "#2563eb",
                              background: "white",
                              borderRadius: "6px",
                              padding: "7px 12px",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
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
      </div>
    </main>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};

const cardTitleStyle = {
  color: "#6b7280",
  fontSize: "14px",
  marginBottom: "8px",
};

const cardValueStyle = {
  color: "#1f2937",
  fontSize: "24px",
  fontWeight: 700,
};

const thStyle = {
  textAlign: "left" as const,
  padding: "12px",
  fontSize: "13px",
  color: "#6b7280",
  whiteSpace: "nowrap" as const,
};

const tdStyle = {
  padding: "14px 12px",
  fontSize: "14px",
  color: "#374151",
};
