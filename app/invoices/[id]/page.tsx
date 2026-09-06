"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-5xl rounded-xl bg-white p-8 text-center">
          Loading invoice...
        </div>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-5xl rounded-xl bg-white p-8">
          <p className="text-red-600">
            {error || "Invoice not found."}
          </p>
          <Link
            href="/invoices"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-white"
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
      <main className="screen-only min-h-screen bg-slate-100">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                J&J PRACTICE CLOUD
              </h1>
              <p className="text-sm text-slate-500">
                Invoice Details
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/invoices"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                ← Invoices
              </Link>

              <Link
                href={`/patients/${invoice.patient_id}`}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Patient
              </Link>

              <button
                type="button"
                onClick={printInvoice}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                🖨 Print Invoice
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

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-sm text-slate-500">
                  Invoice Number
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {invoice.invoice_number || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Invoice Date
                </p>
                <p className="font-semibold">
                  {formatDate(invoice.invoice_date)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Status
                </p>
                <span className="mt-1 inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-medium">
                  {invoice.status || "unpaid"}
                </span>
              </div>
            </div>
          </section>

          {patient && (
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">
                Patient Information
              </h2>

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
            </section>
          )}

          {patient && (
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">
                Medical Aid Information
              </h2>

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
            </section>
          )}

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">
              Invoice Items
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-3 py-3">
                      Description
                    </th>
                    <th className="px-3 py-3">
                      Service Code
                    </th>
                    <th className="px-3 py-3 text-right">
                      Qty
                    </th>
                    <th className="px-3 py-3 text-right">
                      Unit Price
                    </th>
                    <th className="px-3 py-3 text-right">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        No invoice items found.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b"
                      >
                        <td className="px-3 py-3">
                          {item.description || "-"}
                        </td>
                        <td className="px-3 py-3">
                          {item.service_code || "-"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {item.quantity ?? 0}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {currency(item.unit_price)}
                        </td>
                        <td className="px-3 py-3 text-right font-medium">
                          {currency(item.line_total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">
                Invoice Summary
              </h2>

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

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">
                Record Payment
              </h2>

              <div className="space-y-4">
                <Field
                  label="Amount"
                  value={paymentAmount}
                  onChange={setPaymentAmount}
                  type="number"
                  placeholder="0.00"
                />

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(event) =>
                      setPaymentMethod(event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
                  className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingPayment
                    ? "Saving..."
                    : calculatedBalance <= 0.01
                    ? "Invoice Fully Paid"
                    : "Record Payment"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">
              Payment History
            </h2>

            {payments.length === 0 ? (
              <p className="text-sm text-slate-500">
                No payments recorded.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-3 py-3">
                        Payment Number
                      </th>
                      <th className="px-3 py-3">
                        Date
                      </th>
                      <th className="px-3 py-3">
                        Method
                      </th>
                      <th className="px-3 py-3">
                        Reference
                      </th>
                      <th className="px-3 py-3 text-right">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b"
                      >
                        <td className="px-3 py-3">
                          {payment.payment_number || "-"}
                        </td>
                        <td className="px-3 py-3">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="px-3 py-3">
                          {payment.payment_method || "-"}
                        </td>
                        <td className="px-3 py-3">
                          {payment.reference || "-"}
                        </td>
                        <td className="px-3 py-3 text-right font-medium">
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
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-bold">
                Notes
              </h2>
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {invoice.notes}
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
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-800">
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
        placeholder={placeholder}
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
