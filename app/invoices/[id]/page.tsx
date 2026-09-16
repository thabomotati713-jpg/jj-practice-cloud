"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Invoice = {
  id: string;
  practice_id: string;
  patient_id: string;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string | null;
  subtotal: number | null;
  discount: number | null;
  tax: number | null;
  total: number | null;
  amount_paid: number | null;
  balance: number | null;
  payment_method: string | null;
  status: string | null;
  notes: string | null;
  created_by: string | null;
};

type Patient = {
  id: string;
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

type InvoiceItem = {
  id: string;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  service_code: string | null;
};

type Payment = {
  id: string;
  payment_number: string | null;
  payment_date: string;
  amount: number | null;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
};

type PracticeSetting = {
  setting_key: string;
  setting_value: string | null;
};

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = String(params.id);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<
    Record<string, string>
  >({});
  const [provider, setProvider] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printing, setPrinting] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [generatingClaim, setGeneratingClaim] = useState(false);
  const [payLink, setPayLink] = useState("");
  const [payLinkLoading, setPayLinkLoading] = useState(false);
  const [payLinkError, setPayLinkError] = useState("");
  const [payLinkCopied, setPayLinkCopied] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");

  const createPayLink = async () => {
    if (!invoice || !payLinkLoading) return;

    setPayLinkLoading(true);
    setPayLinkError("");
    setPayLink("");
    setPayLinkCopied(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setPayLinkError("Your session has expired. Please sign in again.");
        setPayLinkLoading(false);
        return;
      }

      const response = await fetch(
        `/api/invoices/${invoice.id}/pay-link`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.url) {
        setPayLinkError(result.error || "Could not create the payment link.");
        setPayLinkLoading(false);
        return;
      }

      setPayLink(result.url);
    } catch (payLinkCreateError) {
      console.error(payLinkCreateError);
      setPayLinkError("Something went wrong while creating the payment link.");
    }

    setPayLinkLoading(false);
  };

  const generateClaim = async () => {
    if (!invoice || !patient) return;

    if (
      !patient.medical_aid_provider ||
      !patient.medical_aid_number
    ) {
      setClaimMessage(
        "This patient's medical aid details are incomplete. Add the provider and member number on the patient record first."
      );
      return;
    }

    setGeneratingClaim(true);
    setClaimMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Next sequential claim number, same scheme as claims/new.
      const { data: lastClaims } = await supabase
        .from("medical_aid_claims")
        .select("claim_number")
        .not("claim_number", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      let nextNumber = 1;

      const latestNumber =
        lastClaims && lastClaims.length > 0
          ? lastClaims[0].claim_number
          : null;

      if (latestNumber) {
        const match = latestNumber.match(/(\d+)$/);

        if (match) {
          nextNumber = Number(match[1]) + 1;
        }
      }

      const claimNumber = `CLM-${String(nextNumber).padStart(6, "0")}`;

      const today = new Date().toISOString().slice(0, 10);

      const itemSummary = items
        .map(
          (item) =>
            `${item.service_code || ""}${
              item.service_code ? " " : ""
            }${item.description || ""} x${
              item.quantity || 0
            }`.trim()
        )
        .filter(Boolean)
        .join("; ")
        .slice(0, 400);

      const { data: claim, error: claimError } =
        await supabase
          .from("medical_aid_claims")
          .insert({
            practice_id: invoice.practice_id,
            patient_id: invoice.patient_id,
            invoice_id: invoice.id,
            claim_number: claimNumber,
            claim_date: today,
            medical_aid_provider:
              patient.medical_aid_provider,
            membership_number: patient.medical_aid_number,
            dependent_code:
              patient.medical_aid_dependent_code || null,
            main_member_name:
              patient.medical_aid_main_member || null,
            claimed_amount: invoice.total || 0,
            approved_amount: 0,
            rejected_amount: 0,
            submission_date: today,
            status: "Submitted",
            notes: `Auto-generated from invoice ${
              invoice.invoice_number || ""
            }. Items: ${itemSummary}`,
            created_by: user?.id || null,
          })
          .select("id")
          .single();

      if (claimError) {
        setClaimMessage(claimError.message);
        setGeneratingClaim(false);
        return;
      }

      if (claim) {
        router.push(`/claims/${claim.id}`);
        return;
      }

      setGeneratingClaim(false);
    } catch (claimGenerationError) {
      console.error(claimGenerationError);
      setClaimMessage(
        "Something went wrong while generating the claim."
      );
      setGeneratingClaim(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    setLoading(true);
    setError("");

    const { data: userData } =
      await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/";
      return;
    }

    const { data: invoiceData, error: invoiceError } =
      await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .maybeSingle();

    if (invoiceError) {
      setError(invoiceError.message);
      setLoading(false);
      return;
    }

    if (!invoiceData) {
      setError("Invoice not found.");
      setLoading(false);
      return;
    }

    const loadedInvoice = invoiceData as Invoice;
    setInvoice(loadedInvoice);

    const [
      patientResult,
      itemsResult,
      paymentsResult,
      settingsResult,
    ] = await Promise.all([
      supabase
        .from("patients")
        .select("*")
        .eq("id", loadedInvoice.patient_id)
        .maybeSingle(),

      supabase
        .from("invoice_items")
        .select(
          "id, description, quantity, unit_price, line_total, service_code"
        )
        .eq("invoice_id", invoiceId)
        .order("id", { ascending: true }),

      supabase
        .from("payments")
        .select(
          "id, payment_number, payment_date, amount, payment_method, reference, notes"
        )
        .eq("invoice_id", invoiceId)
        .order("payment_date", { ascending: false }),

      supabase
        .from("practice_settings")
        .select("setting_key, setting_value"),
    ]);

    if (patientResult.data) {
      setPatient(patientResult.data as Patient);
    }

    if (itemsResult.error) {
      setError(itemsResult.error.message);
    } else {
      setItems((itemsResult.data || []) as InvoiceItem[]);
    }

    if (paymentsResult.error) {
      setError(paymentsResult.error.message);
    } else {
      setPayments((paymentsResult.data || []) as Payment[]);
    }

    if (!settingsResult.error) {
      const mapped: Record<string, string> = {};

      (settingsResult.data || []).forEach(
        (setting: PracticeSetting) => {
          if (setting.setting_value !== null) {
            mapped[setting.setting_key] =
              setting.setting_value;
          }
        }
      );

      setSettings(mapped);
    }

    if (loadedInvoice.created_by) {
      const { data: providerData } = await supabase
        .from("profiles")
        .select(
          "id, first_name, last_name, display_name"
        )
        .eq("id", loadedInvoice.created_by)
        .maybeSingle();

      if (providerData) {
        setProvider(providerData as Profile);
      }
    }

    setLoading(false);
  };

  const currency = (value: number | null | undefined) =>
    `R ${(Number(value) || 0).toFixed(2)}`;

  const formatDate = (value: string | null | undefined) => {
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

  const statusBadgeClass = (status: string | null) => {
    const normalized = (status || "unpaid")
      .replace("_", " ")
      .toLowerCase();

    if (
      ["paid", "completed", "active", "in stock"].includes(
        normalized
      )
    ) {
      return "badge badge-green";
    }

    if (
      [
        "pending",
        "submitted",
        "partially paid",
        "scheduled",
        "confirmed",
      ].includes(normalized)
    ) {
      return "badge badge-blue";
    }

    if (["low stock", "no show"].includes(normalized)) {
      return "badge badge-amber";
    }

    if (
      [
        "cancelled",
        "rejected",
        "overdue",
        "out of stock",
      ].includes(normalized)
    ) {
      return "badge badge-red";
    }

    return "badge badge-gray";
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

  const paymentTotal = payments.reduce(
    (sum, payment) =>
      sum + (Number(payment.amount) || 0),
    0
  );

  const invoiceTotal = Number(invoice?.total) || 0;

  const calculatedBalance = Math.max(
    invoiceTotal - paymentTotal,
    0
  );

  const addPayment = async () => {
    if (!invoice || !patient) return;

    setError("");
    setSuccess("");

    const amount = Number(paymentAmount);

    if (!amount || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    if (amount > calculatedBalance + 0.01) {
      setError(
        `Payment cannot exceed the outstanding balance of ${currency(
          calculatedBalance
        )}.`
      );
      return;
    }

    setSavingPayment(true);

    const { data: userData } =
      await supabase.auth.getUser();

    if (!userData.user) {
      setError("Your session has expired.");
      setSavingPayment(false);
      return;
    }

    const paymentNumber =
      `PAY-${Date.now()}`;

    const { error: paymentError } =
      await supabase.from("payments").insert({
        practice_id: invoice.practice_id,
        invoice_id: invoice.id,
        patient_id: invoice.patient_id,
        payment_number: paymentNumber,
        payment_date: new Date().toISOString(),
        amount,
        payment_method: paymentMethod,
        reference: paymentReference.trim() || null,
        notes: paymentNotes.trim() || null,
        received_by: userData.user.id,
      });

    if (paymentError) {
      setError(paymentError.message);
      setSavingPayment(false);
      return;
    }

    const newPaid =
      paymentTotal + amount;

    const newBalance = Math.max(
      invoiceTotal - newPaid,
      0
    );

    let newStatus = "unpaid";

    if (newBalance <= 0.01) {
      newStatus = "paid";
    } else if (newPaid > 0) {
      newStatus = "partially_paid";
    }

    await supabase
      .from("invoices")
      .update({
        amount_paid: newPaid,
        balance: newBalance,
        status: newStatus,
      })
      .eq("id", invoice.id);

    setPaymentAmount("");
    setPaymentReference("");
    setPaymentNotes("");

    setSuccess("Payment recorded successfully.");

    await loadInvoice();

    setSavingPayment(false);
  };

  const printInvoice = () => {
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
      <main className="page-shell">
        <div className="page-inner">
          <div className="card">
            <div className="empty-state">
              Loading invoice...
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="page-shell">
        <div className="page-inner">
          {error && (
            <div className="alert-error">
              {error}
            </div>
          )}

          {!error && (
            <div className="alert-error">
              Invoice not found.
            </div>
          )}

          <Link
            href="/invoices"
            className="btn btn-secondary btn-sm"
          >
            Back to Invoices
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
      <main className="page-shell screen-only">
        <header className="app-header">
          <div className="app-header-inner">
            <a href="/dashboard" className="app-brand">
              <img
                src="/logo.jpg"
                alt="J&J Practice Cloud"
                className="app-brand-logo"
              />
              <span className="app-brand-name">
                J&J Practice Cloud
              </span>
            </a>

            <div className="page-actions">
              <Link
                href="/invoices"
                className="btn btn-secondary btn-sm"
              >
                ← Invoices
              </Link>

              <Link
                href={`/patients/${invoice.patient_id}`}
                className="btn btn-secondary btn-sm"
              >
                Patient
              </Link>

              <button
                type="button"
                onClick={generateClaim}
                disabled={generatingClaim}
                className="btn btn-primary btn-sm"
              >
                {generatingClaim
                  ? "Generating claim..."
                  : "⚡ Generate Claim"}
              </button>

              <button
                type="button"
                onClick={printInvoice}
                className="btn btn-primary btn-sm"
              >
                🖨 Print Invoice
              </button>

              <button
                type="button"
                onClick={createPayLink}
                disabled={payLinkLoading}
                className="btn btn-primary btn-sm"
              >
                {payLinkLoading
                  ? "Creating link..."
                  : "Pay Online"}
              </button>
            </div>
          </div>
        </header>

        {claimMessage && (
          <div className="page-inner" style={{ paddingTop: 0 }}>
            <div className="alert-info">{claimMessage}</div>
          </div>
        )}

        {payLinkError && (
          <div className="page-inner" style={{ paddingTop: 0 }}>
            <div className="alert-error">{payLinkError}</div>
          </div>
        )}

        {payLink && (
          <div className="page-inner" style={{ paddingTop: 0 }}>
            <div
              className="card"
              style={{ padding: "18px 20px" }}
            >
              <p
                className="text-sm font-semibold text-slate-700"
                style={{ marginBottom: 8 }}
              >
                Patient payment link (PayFast — card, SnapScan and more)
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  readOnly
                  value={payLink}
                  className="input"
                  style={{ flex: 1, minWidth: 220 }}
                  onFocus={(event) => event.currentTarget.select()}
                />

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(payLink);
                      setPayLinkCopied(true);
                    } catch {
                      setPayLinkCopied(false);
                    }
                  }}
                >
                  {payLinkCopied ? "Copied" : "Copy link"}
                </button>

                <a
                  href={payLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  Open
                </a>
              </div>

              <p
                className="text-xs text-slate-500"
                style={{ marginTop: 8 }}
              >
                Send this link to the patient on WhatsApp or email. When
                they pay, the invoice is updated automatically.
              </p>
            </div>
          </div>
        )}

        <div className="page-inner">
          <div className="page-header">
            <div>
              <h1 className="page-title">
                Invoice{" "}
                {invoice.invoice_number || ""}
              </h1>
              <p className="page-subtitle">
                Invoice details and payment history
              </p>
            </div>
            <div className="page-actions" />
          </div>

          {error && (
            <div className="alert-error">{error}</div>
          )}

          {success && (
            <div className="alert-success">
              {success}
            </div>
          )}

          <section className="card">
            <div className="card-body">
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <p className="stat-label">
                    Invoice Number
                  </p>
                  <p className="stat-value">
                    {invoice.invoice_number || "-"}
                  </p>
                </div>

                <div>
                  <p className="stat-label">
                    Invoice Date
                  </p>
                  <p className="stat-value">
                    {formatDate(invoice.invoice_date)}
                  </p>
                </div>

                <div>
                  <p className="stat-label">Status</p>
                  <p className="mt-2">
                    <span
                      className={statusBadgeClass(
                        invoice.status
                      )}
                    >
                      {invoice.status || "unpaid"}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {patient && (
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">
                  Patient Information
                </h2>
              </div>

              <div className="card-body">
                <div className="grid gap-4 md:grid-cols-3">
                  <Info
                    label="Patient"
                    value={patientName}
                  />
                  <Info
                    label="Patient ID"
                    value={patient.patient_id}
                  />
                  <Info
                    label="Date of Birth"
                    value={formatDate(patient.date_of_birth)}
                  />
                  <Info
                    label="ID Number"
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
              </div>
            </section>
          )}

          {patient && (
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">
                  Medical Aid Information
                </h2>
              </div>

              <div className="card-body">
                <div className="grid gap-4 md:grid-cols-4">
                  <Info
                    label="Medical Aid"
                    value={
                      patient.medical_aid_provider || "-"
                    }
                  />
                  <Info
                    label="Membership Number"
                    value={
                      patient.medical_aid_number || "-"
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
                      patient.medical_aid_dependent_code ||
                      "-"
                    }
                  />
                  <Info
                    label="Main Member"
                    value={
                      patient.medical_aid_main_member ||
                      "-"
                    }
                  />
                </div>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">
                Invoice Items
              </h2>
            </div>

            <div className="table-wrap border-0 shadow-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Service Code</th>
                    <th className="text-right">
                      Qty
                    </th>
                    <th className="text-right">
                      Unit Price
                    </th>
                    <th className="text-right">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">
                          No invoice items found.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.description || "-"}
                        </td>
                        <td>
                          {item.service_code || "-"}
                        </td>
                        <td className="text-right">
                          {item.quantity ?? 0}
                        </td>
                        <td className="text-right">
                          {currency(item.unit_price)}
                        </td>
                        <td className="text-right font-medium">
                          {currency(item.line_total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  Invoice Summary
                </h2>
              </div>

              <div className="card-body">
                <div className="space-y-3 text-sm">
                  <SummaryRow
                    label="Subtotal"
                    value={currency(invoice.subtotal)}
                  />
                  <SummaryRow
                    label="Discount"
                    value={currency(invoice.discount)}
                  />
                  <SummaryRow
                    label="Tax"
                    value={currency(invoice.tax)}
                  />
                  <SummaryRow
                    label="Total"
                    value={currency(invoice.total)}
                    strong
                  />
                  <SummaryRow
                    label="Payments Received"
                    value={currency(paymentTotal)}
                  />
                  <SummaryRow
                    label="Outstanding"
                    value={currency(calculatedBalance)}
                    strong
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  Record Payment
                </h2>
              </div>

              <div className="card-body">
                <div className="space-y-4">
                  <Field
                    label="Amount"
                    value={paymentAmount}
                    onChange={setPaymentAmount}
                    type="number"
                    placeholder="0.00"
                  />

                  <div className="field">
                    <label className="label">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value)
                      }
                      className="input"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="eft">EFT</option>
                      <option value="medical_aid">
                        Medical Aid
                      </option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <Field
                    label="Reference"
                    value={paymentReference}
                    onChange={setPaymentReference}
                    placeholder="Receipt/reference number"
                  />

                  <Field
                    label="Notes"
                    value={paymentNotes}
                    onChange={setPaymentNotes}
                    placeholder="Payment notes"
                  />

                  <button
                    type="button"
                    onClick={addPayment}
                    disabled={
                      savingPayment ||
                      calculatedBalance <= 0.01
                    }
                    className="btn btn-primary w-full"
                  >
                    {savingPayment
                      ? "Saving..."
                      : calculatedBalance <= 0.01
                      ? "Invoice Fully Paid"
                      : "Record Payment"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">
                Payment History
              </h2>
            </div>

            {payments.length === 0 ? (
              <div className="empty-state">
                No payments recorded.
              </div>
            ) : (
              <div className="table-wrap border-0 shadow-none">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Payment Number</th>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th className="text-right">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>
                          {payment.payment_number || "-"}
                        </td>
                        <td>
                          {formatDate(payment.payment_date)}
                        </td>
                        <td>
                          {payment.payment_method || "-"}
                        </td>
                        <td>
                          {payment.reference || "-"}
                        </td>
                        <td className="text-right font-medium">
                          {currency(payment.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {invoice.notes && (
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Notes</h2>
              </div>

              <div className="card-body">
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {invoice.notes}
                </p>
              </div>
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
                <p>Practice Code: {practiceCode}</p>
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
              INVOICE
            </h2>

            <div className="document-meta">
              <div>
                <strong>Invoice Number:</strong>{" "}
                {invoice.invoice_number || "-"}
              </div>
              <div>
                <strong>Invoice Date:</strong>{" "}
                {formatDate(invoice.invoice_date)}
              </div>
              <div>
                <strong>Due Date:</strong>{" "}
                {formatDate(invoice.due_date)}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                {invoice.status || "unpaid"}
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
                  value={patient?.patient_id || "-"}
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
                  label="Phone"
                  value={patient?.phone || "-"}
                />
                <PrintInfo
                  label="Email"
                  value={patient?.email || "-"}
                />
              </div>
            </div>

            <div className="print-section">
              <h3>Medical Aid Information</h3>

              <div className="print-grid">
                <PrintInfo
                  label="Medical Aid"
                  value={
                    patient?.medical_aid_provider || "-"
                  }
                />
                <PrintInfo
                  label="Membership Number"
                  value={
                    patient?.medical_aid_number || "-"
                  }
                />
                <PrintInfo
                  label="Plan"
                  value={
                    patient?.medical_aid_plan || "-"
                  }
                />
                <PrintInfo
                  label="Dependent Code"
                  value={
                    patient?.medical_aid_dependent_code ||
                    "-"
                  }
                />
                <PrintInfo
                  label="Main Member"
                  value={
                    patient?.medical_aid_main_member ||
                    "-"
                  }
                />
              </div>
            </div>

            <div className="print-section">
              <h3>Invoice Items</h3>

              <table className="print-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Code</th>
                    <th className="right">
                      Qty
                    </th>
                    <th className="right">
                      Unit Price
                    </th>
                    <th className="right">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.description || "-"}
                      </td>
                      <td>
                        {item.service_code || "-"}
                      </td>
                      <td className="right">
                        {item.quantity ?? 0}
                      </td>
                      <td className="right">
                        {currency(item.unit_price)}
                      </td>
                      <td className="right">
                        {currency(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="totals-box">
              <div>
                <span>Subtotal</span>
                <strong>
                  {currency(invoice.subtotal)}
                </strong>
              </div>
              <div>
                <span>Discount</span>
                <strong>
                  {currency(invoice.discount)}
                </strong>
              </div>
              <div>
                <span>Tax</span>
                <strong>
                  {currency(invoice.tax)}
                </strong>
              </div>
              <div className="grand-total">
                <span>Total</span>
                <strong>
                  {currency(invoice.total)}
                </strong>
              </div>
              <div>
                <span>Amount Paid</span>
                <strong>
                  {currency(paymentTotal)}
                </strong>
              </div>
              <div className="balance-row">
                <span>Outstanding Balance</span>
                <strong>
                  {currency(calculatedBalance)}
                </strong>
              </div>
            </div>

            <div className="print-section">
              <h3>Payment History</h3>

              {payments.length === 0 ? (
                <p>No payments recorded.</p>
              ) : (
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Payment Number</th>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th className="right">
                        Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>
                          {payment.payment_number || "-"}
                        </td>
                        <td>
                          {formatDate(
                            payment.payment_date
                          )}
                        </td>
                        <td>
                          {payment.payment_method || "-"}
                        </td>
                        <td>
                          {payment.reference || "-"}
                        </td>
                        <td className="right">
                          {currency(payment.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {invoice.notes && (
              <div className="print-section">
                <h3>Notes</h3>
                <p className="notes">
                  {invoice.notes}
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
                <p>Patient / Responsible Person</p>
                <p>Signature</p>
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
                This document was generated by J&J
                PRACTICE CLOUD.
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
            font-size: 22px;
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

          .print-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
          }

          .print-table th,
          .print-table td {
            border: 1px solid #d1d5db;
            padding: 6px;
            text-align: left;
          }

          .print-table th {
            background: #f3f4f6;
            font-weight: 700;
          }

          .print-table .right,
          .right {
            text-align: right;
          }

          .totals-box {
            width: 52%;
            margin: 15px 0 0 auto;
            border: 1px solid #d1d5db;
          }

          .totals-box > div {
            display: flex;
            justify-content: space-between;
            padding: 5px 8px;
            border-bottom: 1px solid #e5e7eb;
          }

          .totals-box > div:last-child {
            border-bottom: 0;
          }

          .totals-box .grand-total {
            font-size: 13px;
            font-weight: 700;
          }

          .totals-box .balance-row {
            font-size: 12px;
            font-weight: 700;
          }

          .notes {
            white-space: pre-wrap;
          }

          .signature-area {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 60px;
            margin-top: 45px;
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
      <p className="stat-label">{label}</p>
      <p className="mt-1 text-sm font-medium">
        {value}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between border-b border-slate-100 pb-2 ${
        strong ? "font-bold" : ""
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="input"
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
