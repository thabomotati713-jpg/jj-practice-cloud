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
      <main className="page-shell">
        <header className="app-header">
          <div className="app-header-inner">
            <a href="/dashboard" className="app-brand">
              <img src="/logo.jpg" alt="J&J Practice Cloud" className="app-brand-logo" />
              <span className="app-brand-name">J&J Practice Cloud</span>
            </a>
          </div>
        </header>

        <div className="page-inner">
          <div className="empty-state">Loading...</div>
        </div>
      </main>
    );
  }

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
              type="button"
              onClick={() => router.push("/claims")}
              className="btn btn-secondary btn-sm"
            >
              ← Back to Claims
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">New Medical Aid Claim</h1>
            <p className="page-subtitle">
              Create a new medical aid claim for a patient.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Patient &amp; Invoice</h2>
            </div>

            <div className="card-body">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="field">
                  <label className="label" htmlFor="claim-patient">
                    Patient *
                  </label>

                  <select
                    id="claim-patient"
                    value={patientId}
                    onChange={(e) => handlePatientChange(e.target.value)}
                    className="input"
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

                <div className="field">
                  <label className="label" htmlFor="claim-invoice">
                    Invoice
                  </label>

                  <select
                    id="claim-invoice"
                    value={invoiceId}
                    onChange={(e) => handleInvoiceChange(e.target.value)}
                    className="input"
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
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Claim Information</h2>
            </div>

            <div className="card-body">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="field">
                  <label className="label" htmlFor="claim-number">
                    Claim Number
                  </label>
                  <input
                    id="claim-number"
                    value={claimNumber}
                    onChange={(e) => setClaimNumber(e.target.value)}
                    placeholder="Leave blank to generate automatically"
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="claim-date">
                    Claim Date *
                  </label>
                  <input
                    id="claim-date"
                    type="date"
                    value={claimDate}
                    onChange={(e) => setClaimDate(e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="claim-provider">
                    Medical Aid Provider *
                  </label>
                  <input
                    id="claim-provider"
                    value={medicalAidProvider}
                    onChange={(e) => setMedicalAidProvider(e.target.value)}
                    placeholder="e.g. Discovery Health"
                    className="input"
                    required
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="claim-membership">
                    Membership Number *
                  </label>
                  <input
                    id="claim-membership"
                    value={membershipNumber}
                    onChange={(e) => setMembershipNumber(e.target.value)}
                    placeholder="Membership number"
                    className="input"
                    required
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="claim-dependent-code">
                    Dependent Code
                  </label>
                  <input
                    id="claim-dependent-code"
                    value={dependentCode}
                    onChange={(e) => setDependentCode(e.target.value)}
                    placeholder="e.g. 00"
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="claim-main-member">
                    Main Member Name
                  </label>
                  <input
                    id="claim-main-member"
                    value={mainMemberName}
                    onChange={(e) => setMainMemberName(e.target.value)}
                    placeholder="Main member's name"
                    className="input"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Claim Amounts</h2>
            </div>

            <div className="card-body">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="field">
                  <label className="label" htmlFor="claim-claimed-amount">
                    Claimed Amount *
                  </label>
                  <input
                    id="claim-claimed-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={claimedAmount}
                    onChange={(e) => setClaimedAmount(e.target.value)}
                    placeholder="0.00"
                    className="input"
                    required
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="claim-approved-amount">
                    Approved Amount
                  </label>
                  <input
                    id="claim-approved-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="claim-rejected-amount">
                    Rejected Amount
                  </label>
                  <input
                    id="claim-rejected-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={rejectedAmount}
                    onChange={(e) => setRejectedAmount(e.target.value)}
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="claim-status">
                    Status *
                  </label>

                  <select
                    id="claim-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="input"
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
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Submission &amp; Response</h2>
            </div>

            <div className="card-body">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="field">
                  <label className="label" htmlFor="claim-submission-date">
                    Submission Date
                  </label>
                  <input
                    id="claim-submission-date"
                    type="date"
                    value={submissionDate}
                    onChange={(e) => setSubmissionDate(e.target.value)}
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="claim-response-date">
                    Response Date
                  </label>
                  <input
                    id="claim-response-date"
                    type="date"
                    value={responseDate}
                    onChange={(e) => setResponseDate(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="claim-rejection-reason">
                  Rejection Reason
                </label>

                <textarea
                  id="claim-rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason if applicable"
                  rows={3}
                  className="input"
                />
              </div>

              <div className="field" >
                <label className="label" htmlFor="claim-notes">
                  Notes
                </label>

                <textarea
                  id="claim-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional claim notes"
                  rows={4}
                  className="input"
                />
              </div>
            </div>
          </div>

          {message && (
            <div className="alert-error">{message}</div>
          )}

          <div className="page-actions justify-end mb-10">
            <button
              type="button"
              onClick={() => router.push("/claims")}
              className="btn btn-secondary"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? "Saving..." : "Create Claim"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
