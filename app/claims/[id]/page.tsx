"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Claim = {
  id: string;
  practice_id: string;
  patient_id: string;
  invoice_id: string | null;
  claim_number: string | null;
  claim_date: string;
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
  created_by: string | null;
};

type Patient = {
  patient_id: string;
  title: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  id_number: string | null;
  passport_number: string | null;
  phone: string | null;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  medical_aid_provider: string | null;
  medical_aid_number: string | null;
  medical_aid_plan: string | null;
  medical_aid_dependent_code: string | null;
  medical_aid_main_member: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  total: number | null;
  amount_paid: number | null;
  balance: number | null;
  status: string | null;
};

type Setting = {
  setting_key: string;
  setting_value: string | null;
};

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
};

export default function ClaimDetailPage() {
  const params = useParams();
  const claimId = String(params.id);

  const [claim, setClaim] = useState<Claim | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [provider, setProvider] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [status, setStatus] = useState("pending");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [rejectedAmount, setRejectedAmount] = useState("");
  const [submissionDate, setSubmissionDate] = useState("");
  const [responseDate, setResponseDate] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadClaim();
  }, [claimId]);

  const loadClaim = async () => {
    setLoading(true);
    setError("");

    const { data: userData } =
      await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/";
      return;
    }

    const { data: claimData, error: claimError } =
      await supabase
        .from("medical_aid_claims")
        .select("*")
        .eq("id", claimId)
        .maybeSingle();

    if (claimError) {
      setError(claimError.message);
      setLoading(false);
      return;
    }

    if (!claimData) {
      setError("Claim not found.");
      setLoading(false);
      return;
    }

    const loadedClaim = claimData as Claim;

    setClaim(loadedClaim);

    setStatus(
      loadedClaim.status || "pending"
    );

    setApprovedAmount(
      String(loadedClaim.approved_amount || 0)
    );

    setRejectedAmount(
      String(loadedClaim.rejected_amount || 0)
    );

    setSubmissionDate(
      loadedClaim.submission_date || ""
    );

    setResponseDate(
      loadedClaim.response_date || ""
    );

    setRejectionReason(
      loadedClaim.rejection_reason || ""
    );

    setNotes(loadedClaim.notes || "");

    const [
      patientResult,
      invoiceResult,
      settingsResult,
    ] = await Promise.all([
      supabase
        .from("patients")
        .select("*")
        .eq("id", loadedClaim.patient_id)
        .maybeSingle(),

      loadedClaim.invoice_id
        ? supabase
            .from("invoices")
            .select(
              "id, invoice_number, invoice_date, total, amount_paid, balance, status"
            )
            .eq("id", loadedClaim.invoice_id)
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),

      supabase
        .from("practice_settings")
        .select("setting_key, setting_value"),
    ]);

    if (patientResult.data) {
      setPatient(patientResult.data as Patient);
    }

    if (invoiceResult.data) {
      setInvoice(invoiceResult.data as Invoice);
    }

    if (!settingsResult.error) {
      const mapped: Record<string, string> = {};

      (settingsResult.data || []).forEach(
        (setting: Setting) => {
          if (setting.setting_value !== null) {
            mapped[setting.setting_key] =
              setting.setting_value;
          }
        }
      );

      setSettings(mapped);
    }

    if (loadedClaim.created_by) {
      const { data: providerData } =
        await supabase
          .from("profiles")
          .select(
            "id, first_name, last_name, display_name"
          )
          .eq("id", loadedClaim.created_by)
          .maybeSingle();

      if (providerData) {
        setProvider(providerData as Profile);
      }
    }

    setLoading(false);
  };

  const currency = (
    value: number | null | undefined
  ) => `R ${(Number(value) || 0).toFixed(2)}`;

  const formatDate = (
    value: string | null | undefined
  ) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const patientName = patient
    ? [
        patient.title,
        patient.first_name,
        patient.middle_name,
        patient.last_name,
      ]
        .filter(Boolean)
        .join(" ")
    : "Patient";

  const providerName =
    provider?.display_name ||
    [provider?.first_name, provider?.last_name]
      .filter(Boolean)
      .join(" ") ||
    "J&J Practitioner";

  const claimedAmount =
    Number(claim?.claimed_amount) || 0;

  const approved =
    Number(approvedAmount) || 0;

  const rejected =
    Number(rejectedAmount) || 0;

  const unallocated = Math.max(
    claimedAmount - approved - rejected,
    0
  );

  const saveClaim = async () => {
    if (!claim) return;

    setError("");
    setSuccess("");

    if (approved < 0 || rejected < 0) {
      setError(
        "Approved and rejected amounts cannot be negative."
      );
      return;
    }

    if (
      approved + rejected >
      claimedAmount + 0.01
    ) {
      setError(
        "Approved plus rejected amounts cannot exceed the claimed amount."
      );
      return;
    }

    if (
      responseDate &&
      submissionDate &&
      responseDate < submissionDate
    ) {
      setError(
        "Response date cannot be before submission date."
      );
      return;
    }

    setSaving(true);

    const { error: updateError } =
      await supabase
        .from("medical_aid_claims")
        .update({
          status,
          approved_amount: approved,
          rejected_amount: rejected,
          submission_date:
            submissionDate || null,
          response_date:
            responseDate || null,
          rejection_reason:
            rejectionReason.trim() || null,
          notes: notes.trim() || null,
        })
        .eq("id", claim.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSuccess(
      "Claim updated successfully."
    );

    await loadClaim();

    setSaving(false);
  };

  const printClaim = () => {
    setPrinting(true);

    setTimeout(() => {
      window.print();

      setTimeout(() => {
        setPrinting(false);
      }, 500);
    }, 300);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-5xl rounded-xl bg-white p-8 text-center">
          Loading claim...
        </div>
      </main>
    );
  }

  if (!claim) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-5xl rounded-xl bg-white p-8">
          <p className="text-red-600">
            {error || "Claim not found."}
          </p>

          <Link
            href="/claims"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-white"
          >
            Back to Claims
          </Link>
        </div>
      </main>
    );
  }

  const practiceName =
    settings.practice_name ||
    settings.practiceName ||
    "J & J PRACTICE MEDICAL CENTRE";

  const practiceCode =
    settings.practice_code ||
    settings.practiceCode ||
    "773";

  const practicePhone =
    settings.phone || "0718272091";

  const practiceEmail =
    settings.email ||
    "thabomotati713@gmail.com";

  const practiceAddress =
    settings.address || "Zone 14";

  const practiceCity =
    settings.city || "Sebokeng";

  const practiceProvince =
    settings.province || "Gauteng";

  const practicePostal =
    settings.postal_code ||
    settings.postalCode ||
    "1983";

  const practiceCountry =
    settings.country || "South Africa";

  const logoUrl =
    settings.logo_url ||
    settings.logoUrl ||
    "";

  return (
    <>
      <main className="screen-only min-h-screen bg-slate-100">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                J&J PRACTICE CLOUD
              </h1>
              <p className="text-sm text-slate-500">
                Medical Aid Claim
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/claims"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                ← Claims
              </Link>

              <Link
                href={`/patients/${claim.patient_id}`}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Patient
              </Link>

              {claim.invoice_id && (
                <Link
                  href={`/invoices/${claim.invoice_id}`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Invoice
                </Link>
              )}

              <button
                type="button"
                onClick={printClaim}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                🖨 Print Claim Form
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-6 p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              {success}
            </div>
          )}

          <section className="grid gap-4 md:grid-cols-4">
            <Stat
              label="Claimed"
              value={currency(claim.claimed_amount)}
            />
            <Stat
              label="Approved"
              value={currency(claim.approved_amount)}
            />
            <Stat
              label="Rejected"
              value={currency(claim.rejected_amount)}
            />
            <Stat
              label="Unallocated"
              value={currency(unallocated)}
            />
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-sm text-slate-500">
                  Claim Number
                </p>
                <h2 className="text-2xl font-bold">
                  {claim.claim_number || "-"}
                </h2>
              </div>

              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium">
                {claim.status || "pending"}
              </span>
            </div>
          </section>

          {patient && (
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">
                Patient Information
              </h2>

              <div className="grid gap-4 md:grid-cols-3">
                <Info
                  label="Patient Name"
                  value={patientName}
                />
                <Info
                  label="Patient ID"
                  value={patient.patient_id}
                />
                <Info
                  label="Date of Birth"
                  value={formatDate(
                    patient.date_of_birth
                  )}
                />
                <Info
                  label="ID / Passport"
                  value={
                    patient.id_number ||
                    patient.passport_number ||
                    "-"
                  }
                />
                <Info
                  label="Phone"
                  value={patient.phone || "-"}
                />
                <Info
                  label="Email"
                  value={patient.email || "-"}
                />
              </div>
            </section>
          )}

          {patient && (
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">
                Medical Aid Information
              </h2>

              <div className="grid gap-4 md:grid-cols-3">
                <Info
                  label="Medical Aid Provider"
                  value={
                    claim.medical_aid_provider ||
                    patient.medical_aid_provider ||
                    "-"
                  }
                />

                <Info
                  label="Membership Number"
                  value={
                    claim.membership_number ||
                    patient.medical_aid_number ||
                    "-"
                  }
                />

                <Info
                  label="Plan"
                  value={
                    patient.medical_aid_plan || "-"
                  }
                />

                <Info
                  label="Dependent Code"
                  value={
                    claim.dependent_code ||
                    patient.medical_aid_dependent_code ||
                    "-"
                  }
                />

                <Info
                  label="Main Member"
                  value={
                    claim.main_member_name ||
                    patient.medical_aid_main_member ||
                    "-"
                  }
                />
              </div>
            </section>
          )}

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">
              Claim Information
            </h2>

            <div className="grid gap-4 md:grid-cols-4">
              <Info
                label="Claim Number"
                value={
                  claim.claim_number || "-"
                }
              />

              <Info
                label="Claim Date"
                value={formatDate(claim.claim_date)}
              />

              <Info
                label="Submission Date"
                value={formatDate(
                  claim.submission_date
                )}
              />

              <Info
                label="Response Date"
                value={formatDate(
                  claim.response_date
                )}
              />
            </div>
          </section>

          {invoice && (
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">
                Linked Invoice
              </h2>

              <div className="grid gap-4 md:grid-cols-5">
                <Info
                  label="Invoice Number"
                  value={
                    invoice.invoice_number || "-"
                  }
                />

                <Info
                  label="Invoice Date"
                  value={formatDate(
                    invoice.invoice_date
                  )}
                />

                <Info
                  label="Invoice Total"
                  value={currency(invoice.total)}
                />

                <Info
                  label="Amount Paid"
                  value={currency(
                    invoice.amount_paid
                  )}
                />

                <Info
                  label="Balance"
                  value={currency(invoice.balance)}
                />
              </div>
            </section>
          )}

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">
              Update Claim
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Status
                </label>

                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="pending">
                    Pending
                  </option>
                  <option value="submitted">
                    Submitted
                  </option>
                  <option value="approved">
                    Approved
                  </option>
                  <option value="partially_approved">
                    Partially Approved
                  </option>
                  <option value="rejected">
                    Rejected
                  </option>
                  <option value="paid">
                    Paid
                  </option>
                  <option value="cancelled">
                    Cancelled
                  </option>
                </select>
              </div>

              <Field
                label="Approved Amount"
                type="number"
                value={approvedAmount}
                onChange={setApprovedAmount}
              />

              <Field
                label="Rejected Amount"
                type="number"
                value={rejectedAmount}
                onChange={setRejectedAmount}
              />

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Submission Date
                </label>
                <input
                  type="date"
                  value={submissionDate}
                  onChange={(event) =>
                    setSubmissionDate(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Response Date
                </label>
                <input
                  type="date"
                  value={responseDate}
                  onChange={(event) =>
                    setResponseDate(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <Field
                label="Rejection Reason"
                value={rejectionReason}
                onChange={setRejectionReason}
              />

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Notes
                </label>

                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={saveClaim}
              disabled={saving}
              className="mt-5 rounded-lg bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>
          </section>

          {claim.rejection_reason && (
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-bold">
                Rejection Reason
              </h2>

              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {claim.rejection_reason}
              </p>
            </section>
          )}

          {claim.notes && (
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-bold">
                Notes
              </h2>

              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {claim.notes}
              </p>
            </section>
          )}
        </div>
      </main>

      {printing && (
        <div className="print-document">
          <div className="print-letterhead">
            <div className="letterhead-top">
              <div className="logo-area">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="J&J Practice Logo"
                    className="practice-logo"
                  />
                ) : (
                  <div className="logo-placeholder">
                    J&J
                  </div>
                )}
              </div>

              <div className="practice-details">
                <h1>{practiceName}</h1>
                <p>
                  Practice Code: {practiceCode}
                </p>
                <p>{practiceAddress}</p>
                <p>
                  {practiceCity}, {practiceProvince}{" "}
                  {practicePostal}
                </p>
                <p>{practiceCountry}</p>
                <p>Tel: {practicePhone}</p>
                <p>Email: {practiceEmail}</p>
              </div>
            </div>

            <div className="blue-line" />

            <h2 className="document-title">
              MEDICAL AID CLAIM FORM
            </h2>

            <div className="document-meta">
              <div>
                <strong>Claim Number:</strong>{" "}
                {claim.claim_number || "-"}
              </div>

              <div>
                <strong>Claim Date:</strong>{" "}
                {formatDate(claim.claim_date)}
              </div>

              <div>
                <strong>Status:</strong>{" "}
                {claim.status || "pending"}
              </div>

              <div>
                <strong>Provider:</strong>{" "}
                {providerName}
              </div>
            </div>

            <div className="print-section">
              <h3>Patient Information</h3>

              <div className="print-grid">
                <PrintInfo
                  label="Patient Name"
                  value={patientName}
                />

                <PrintInfo
                  label="Patient ID"
                  value={
                    patient?.patient_id || "-"
                  }
                />

                <PrintInfo
                  label="Date of Birth"
                  value={formatDate(
                    patient?.date_of_birth
                  )}
                />

                <PrintInfo
                  label="ID / Passport"
                  value={
                    patient?.id_number ||
                    patient?.passport_number ||
                    "-"
                  }
                />

                <PrintInfo
                  label="Gender"
                  value={
                    patient?.gender || "-"
                  }
                />

                <PrintInfo
                  label="Phone"
                  value={
                    patient?.phone || "-"
                  }
                />

                <PrintInfo
                  label="Email"
                  value={
                    patient?.email || "-"
                  }
                />
              </div>
            </div>

            <div className="print-section">
              <h3>Medical Aid Information</h3>

              <div className="print-grid">
                <PrintInfo
                  label="Medical Aid Provider"
                  value={
                    claim.medical_aid_provider ||
                    patient?.medical_aid_provider ||
                    "-"
                  }
                />

                <PrintInfo
                  label="Membership Number"
                  value={
                    claim.membership_number ||
                    patient?.medical_aid_number ||
                    "-"
                  }
                />

                <PrintInfo
                  label="Plan"
                  value={
                    patient?.medical_aid_plan ||
                    "-"
                  }
                />

                <PrintInfo
                  label="Dependent Code"
                  value={
                    claim.dependent_code ||
                    patient?.medical_aid_dependent_code ||
                    "-"
                  }
                />

                <PrintInfo
                  label="Main Member"
                  value={
                    claim.main_member_name ||
                    patient?.medical_aid_main_member ||
                    "-"
                  }
                />
              </div>
            </div>

            <div className="print-section">
              <h3>Claim Details</h3>

              <div className="print-grid">
                <PrintInfo
                  label="Claim Number"
                  value={
                    claim.claim_number || "-"
                  }
                />

                <PrintInfo
                  label="Claim Date"
                  value={formatDate(
                    claim.claim_date
                  )}
                />

                <PrintInfo
                  label="Submission Date"
                  value={formatDate(
                    claim.submission_date
                  )}
                />

                <PrintInfo
                  label="Response Date"
                  value={formatDate(
                    claim.response_date
                  )}
                />
              </div>
            </div>

            {invoice && (
              <div className="print-section">
                <h3>Linked Invoice</h3>

                <div className="print-grid">
                  <PrintInfo
                    label="Invoice Number"
                    value={
                      invoice.invoice_number ||
                      "-"
                    }
                  />

                  <PrintInfo
                    label="Invoice Date"
                    value={formatDate(
                      invoice.invoice_date
                    )}
                  />

                  <PrintInfo
                    label="Invoice Total"
                    value={currency(
                      invoice.total
                    )}
                  />

                  <PrintInfo
                    label="Amount Paid"
                    value={currency(
                      invoice.amount_paid
                    )}
                  />

                  <PrintInfo
                    label="Invoice Balance"
                    value={currency(
                      invoice.balance
                    )}
                  />
                </div>
              </div>
            )}

            <div className="amounts-box">
              <div>
                <span>Claimed Amount</span>
                <strong>
                  {currency(
                    claim.claimed_amount
                  )}
                </strong>
              </div>

              <div>
                <span>Approved Amount</span>
                <strong>
                  {currency(
                    claim.approved_amount
                  )}
                </strong>
              </div>

              <div>
                <span>Rejected Amount</span>
                <strong>
                  {currency(
                    claim.rejected_amount
                  )}
                </strong>
              </div>

              <div className="unallocated">
                <span>Unallocated Amount</span>
                <strong>
                  {currency(unallocated)}
                </strong>
              </div>
            </div>

            {claim.rejection_reason && (
              <div className="print-section">
                <h3>Rejection Reason</h3>
                <p className="notes">
                  {claim.rejection_reason}
                </p>
              </div>
            )}

            {claim.notes && (
              <div className="print-section">
                <h3>Notes</h3>
                <p className="notes">
                  {claim.notes}
                </p>
              </div>
            )}

            <div className="signature-area">
              <div>
                <div className="signature-line" />
                <p>
                  Practitioner: {providerName}
                </p>
                <p>Signature</p>
              </div>

              <div>
                <div className="signature-line" />
                <p>Practice Stamp</p>
                <p>Official Stamp</p>
              </div>
            </div>

            <div className="print-footer">
              <p>
                {practiceName} • Practice Code{" "}
                {practiceCode}
              </p>

              <p>
                {practicePhone} • {practiceEmail}
              </p>

              <p>
                This document was generated by
                J&J PRACTICE CLOUD.
              </p>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .print-document {
          display: none;
        }

        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }

          body {
            background: white !important;
          }

          .screen-only {
            display: none !important;
          }

          .print-document {
            display: block !important;
            width: 100%;
            background: white;
            color: #111827;
          }

          .print-letterhead {
            width: 100%;
            min-height: 260mm;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
          }

          .letterhead-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }

          .logo-area {
            width: 38%;
          }

          .practice-logo {
            max-width: 180px;
            max-height: 95px;
            object-fit: contain;
          }

          .logo-placeholder {
            display: flex;
            width: 90px;
            height: 70px;
            align-items: center;
            justify-content: center;
            border: 2px solid #1e3a8a;
            font-size: 26px;
            font-weight: 700;
            color: #1e3a8a;
          }

          .practice-details {
            width: 58%;
            text-align: right;
          }

          .practice-details h1 {
            margin: 0 0 5px;
            font-size: 18px;
            font-weight: 700;
          }

          .practice-details p {
            margin: 2px 0;
          }

          .blue-line {
            height: 2px;
            margin-top: 12px;
            background: #2563eb;
          }

          .document-title {
            margin: 18px 0;
            text-align: center;
            font-size: 21px;
            font-weight: 700;
            letter-spacing: 1px;
          }

          .document-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px 25px;
            margin-bottom: 18px;
            padding: 10px;
            border: 1px solid #d1d5db;
          }

          .print-section {
            margin-top: 16px;
          }

          .print-section h3 {
            margin: 0 0 7px;
            padding-bottom: 4px;
            border-bottom: 1px solid #d1d5db;
            font-size: 13px;
            font-weight: 700;
          }

          .print-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px 15px;
          }

          .print-info {
            min-height: 28px;
          }

          .print-info-label {
            font-size: 9px;
            color: #6b7280;
          }

          .print-info-value {
            font-weight: 600;
          }

          .amounts-box {
            width: 55%;
            margin: 20px 0 0 auto;
            border: 1px solid #d1d5db;
          }

          .amounts-box > div {
            display: flex;
            justify-content: space-between;
            padding: 7px 9px;
            border-bottom: 1px solid #e5e7eb;
          }

          .amounts-box > div:last-child {
            border-bottom: 0;
          }

          .amounts-box .unallocated {
            font-weight: 700;
          }

          .notes {
            white-space: pre-wrap;
          }

          .signature-area {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 60px;
            margin-top: 50px;
          }

          .signature-line {
            height: 1px;
            margin-bottom: 5px;
            background: #111827;
          }

          .signature-area p {
            margin: 2px 0;
          }

          .print-footer {
            margin-top: 30px;
            padding-top: 8px;
            border-top: 1px solid #d1d5db;
            text-align: center;
            font-size: 9px;
            color: #6b7280;
          }
        }
      `}</style>
    </>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />
    </div>
  );
}

function PrintInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="print-info">
      <div className="print-info-label">
        {label}
      </div>
      <div className="print-info-value">
        {value}
      </div>
    </div>
  );
}
