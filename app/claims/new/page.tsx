"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Patient = {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  medical_aid_provider: string | null;
  medical_aid_number: string | null;
  medical_aid_dependent_code: string | null;
  medical_aid_main_member: string | null;
};

type Invoice = {
  id: string;
  patient_id: string;
  invoice_number: string;
  invoice_date: string;
  total: number | null;
  balance: number | null;
};

export default function NewClaimPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [patientId, setPatientId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");

  const [claimNumber, setClaimNumber] = useState("");
  const [claimDate, setClaimDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [medicalAidProvider, setMedicalAidProvider] = useState("");
  const [membershipNumber, setMembershipNumber] = useState("");
  const [dependentCode, setDependentCode] = useState("");
  const [mainMemberName, setMainMemberName] = useState("");

  const [claimedAmount, setClaimedAmount] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("0");
  const [rejectedAmount, setRejectedAmount] = useState("0");

  const [submissionDate, setSubmissionDate] = useState("");
  const [responseDate, setResponseDate] = useState("");

  const [status, setStatus] = useState("pending");
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [{ data: patientData, error: patientError }, { data: invoiceData, error: invoiceError }] =
      await Promise.all([
        supabase
          .from("patients")
          .select(
            "id, patient_id, first_name, last_name, medical_aid_provider, medical_aid_number, medical_aid_dependent_code, medical_aid_main_member"
          )
          .order("last_name", { ascending: true }),

        supabase
          .from("invoices")
          .select("id, patient_id, invoice_number, invoice_date, total, balance")
          .order("invoice_date", { ascending: false }),
      ]);

    if (patientError) {
      console.error("Error loading patients:", patientError);
    }

    if (invoiceError) {
      console.error("Error loading invoices:", invoiceError);
    }

    setPatients(patientData || []);
    setInvoices(invoiceData || []);
    setLoading(false);
  }

  function handlePatientChange(id: string) {
    setPatientId(id);

    const patient = patients.find((item) => item.id === id);

    if (!patient) return;

    setMedicalAidProvider(patient.medical_aid_provider || "");
    setMembershipNumber(patient.medical_aid_number || "");
    setDependentCode(patient.medical_aid_dependent_code || "");
    setMainMemberName(patient.medical_aid_main_member || "");

    setInvoiceId("");
    setClaimedAmount("");
  }

  function handleInvoiceChange(id: string) {
    setInvoiceId(id);

    const invoice = invoices.find((item) => item.id === id);

    if (!invoice) return;

    setClaimedAmount(String(invoice.balance ?? invoice.total ?? 0));
  }

  const patientInvoices = invoices.filter(
    (invoice) => invoice.patient_id === patientId
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!patientId) {
      setMessage("Please select a patient.");
      return;
    }

    if (!medicalAidProvider.trim()) {
      setMessage("Please enter the medical aid provider.");
      return;
    }

    if (!membershipNumber.trim()) {
      setMessage("Please enter the membership number.");
      return;
    }

    if (!claimedAmount || Number(claimedAmount) <= 0) {
      setMessage("Please enter a valid claimed amount.");
      return;
    }

    setSaving(true);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        setMessage("You must be logged in to create a claim.");
        setSaving(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("practice_id")
        .eq("id", userData.user.id)
        .single();

      if (profileError || !profile?.practice_id) {
        console.error("Profile error:", profileError);
        setMessage("Could not determine your practice.");
        setSaving(false);
        return;
      }

      const { data: existingClaims } = await supabase
        .from("medical_aid_claims")
        .select("claim_number")
        .not("claim_number", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      let finalClaimNumber = claimNumber.trim();

      if (!finalClaimNumber) {
        const latestNumber =
          existingClaims && existingClaims.length > 0
            ? existingClaims[0].claim_number
            : null;

        let nextNumber = 1;

        if (latestNumber) {
          const match = latestNumber.match(/(\d+)$/);

          if (match) {
            nextNumber = Number(match[1]) + 1;
          }
        }

        finalClaimNumber = `CLM-${String(nextNumber).padStart(6, "0")}`;
      }

      const { error } = await supabase
        .from("medical_aid_claims")
        .insert({
          practice_id: profile.practice_id,
          patient_id: patientId,
          invoice_id: invoiceId || null,
          claim_number: finalClaimNumber,
          claim_date: claimDate || null,
          medical_aid_provider: medicalAidProvider.trim(),
          membership_number: membershipNumber.trim(),
          dependent_code: dependentCode.trim() || null,
          main_member_name: mainMemberName.trim() || null,
          claimed_amount: Number(claimedAmount),
          approved_amount: Number(approvedAmount || 0),
          rejected_amount: Number(rejectedAmount || 0),
          submission_date: submissionDate || null,
          response_date: responseDate || null,
          status,
          rejection_reason: rejectionReason.trim() || null,
          notes: notes.trim() || null,
          created_by: userData.user.id,
        });

      if (error) {
        console.error("Error creating claim:", error);
        setMessage(error.message);
        setSaving(false);
        return;
      }

      router.push("/claims");
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while creating the claim.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f5f7fb",
          padding: "30px",
        }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <p>Loading...</p>
        </div>
      </main>
    );
  }

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
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/claims")}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            marginBottom: "10px",
            color: "#555",
          }}
        >
          ← Back to Claims
        </button>

        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "32px",
            color: "#1f2937",
          }}
        >
          New Medical Aid Claim
        </h1>

        <p
          style={{
            color: "#6b7280",
            marginBottom: "25px",
          }}
        >
          Create a new medical aid claim for a patient.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Patient & Invoice</h2>

            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Patient *</label>

                <select
                  value={patientId}
                  onChange={(e) => handlePatientChange(e.target.value)}
                  style={inputStyle}
                  required
                >
                  <option value="">Select patient</option>

                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.patient_id} — {patient.first_name}{" "}
                      {patient.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Invoice</label>

                <select
                  value={invoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  style={inputStyle}
                  disabled={!patientId}
                >
                  <option value="">
                    {patientId
                      ? "Select invoice (optional)"
                      : "Select a patient first"}
                  </option>

                  {patientInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} — R{" "}
                      {Number(invoice.total || 0).toFixed(2)} — Balance R{" "}
                      {Number(invoice.balance || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Claim Information</h2>

            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Claim Number</label>
                <input
                  value={claimNumber}
                  onChange={(e) => setClaimNumber(e.target.value)}
                  placeholder="Leave blank to generate automatically"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Claim Date *</label>
                <input
                  type="date"
                  value={claimDate}
                  onChange={(e) => setClaimDate(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Medical Aid Provider *</label>
                <input
                  value={medicalAidProvider}
                  onChange={(e) => setMedicalAidProvider(e.target.value)}
                  placeholder="e.g. Discovery Health"
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Membership Number *</label>
                <input
                  value={membershipNumber}
                  onChange={(e) => setMembershipNumber(e.target.value)}
                  placeholder="Membership number"
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Dependent Code</label>
                <input
                  value={dependentCode}
                  onChange={(e) => setDependentCode(e.target.value)}
                  placeholder="e.g. 00"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Main Member Name</label>
                <input
                  value={mainMemberName}
                  onChange={(e) => setMainMemberName(e.target.value)}
                  placeholder="Main member's name"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Claim Amounts</h2>

            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Claimed Amount *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={claimedAmount}
                  onChange={(e) => setClaimedAmount(e.target.value)}
                  placeholder="0.00"
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Approved Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Rejected Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rejectedAmount}
                  onChange={(e) => setRejectedAmount(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Status *</label>

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={inputStyle}
                  required
                >
                  <option value="pending">Pending</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="partially_approved">
                    Partially Approved
                  </option>
                  <option value="rejected">Rejected</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Submission & Response</h2>

            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Submission Date</label>
                <input
                  type="date"
                  value={submissionDate}
                  onChange={(e) => setSubmissionDate(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Response Date</label>
                <input
                  type="date"
                  value={responseDate}
                  onChange={(e) => setResponseDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: "20px" }}>
              <label style={labelStyle}>Rejection Reason</label>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason if applicable"
                rows={3}
                style={textareaStyle}
              />
            </div>

            <div style={{ marginTop: "20px" }}>
              <label style={labelStyle}>Notes</label>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional claim notes"
                rows={4}
                style={textareaStyle}
              />
            </div>
          </div>

          {message && (
            <div
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                padding: "12px 15px",
                borderRadius: "8px",
                marginBottom: "20px",
              }}
            >
              {message}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "flex-end",
              marginBottom: "40px",
            }}
          >
            <button
              type="button"
              onClick={() => router.push("/claims")}
              style={secondaryButtonStyle}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              style={{
                ...primaryButtonStyle,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Create Claim"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

const sectionStyle = {
  background: "white",
  borderRadius: "12px",
  padding: "24px",
  marginBottom: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};

const sectionTitleStyle = {
  margin: "0 0 20px",
  fontSize: "20px",
  color: "#1f2937",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "18px",
};

const labelStyle = {
  display: "block",
  marginBottom: "7px",
  fontSize: "14px",
  fontWeight: 600,
  color: "#374151",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "11px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "7px",
  fontSize: "14px",
  background: "white",
};

const textareaStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "11px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "7px",
  fontSize: "14px",
  resize: "vertical" as const,
};

const primaryButtonStyle = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "7px",
  padding: "12px 20px",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  background: "white",
  color: "#374151",
  border: "1px solid #d1d5db",
  borderRadius: "7px",
  padding: "12px 20px",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
};
