"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Patient = {
  id: string;
  patient_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

type Invoice = {
  id: string;
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
};

type InvoiceItem = {
  invoice_id: string;
  description: string;
  item_type: string | null;
  quantity: number | null;
  unit_price: number | null;
  discount: number | null;
  tax: number | null;
  line_total: number | null;
  service_code: string | null;
};

export default function PatientBillingPage() {
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [patientId]);

  const loadData = async () => {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/";
      return;
    }

    const { data: patientData, error: patientError } =
      await supabase
        .from("patients")
        .select(
          "id, patient_id, first_name, middle_name, last_name"
        )
        .eq("id", patientId)
        .single();

    if (patientError || !patientData) {
      setError("Patient could not be found.");
      setLoading(false);
      return;
    }

    setPatient(patientData as Patient);

    const { data: invoiceData, error: invoiceError } =
      await supabase
        .from("invoices")
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          subtotal,
          discount,
          tax,
          total,
          amount_paid,
          balance,
          payment_method,
          status,
          notes
        `)
        .eq("patient_id", patientId)
        .order("invoice_date", { ascending: false });

    if (invoiceError) {
      setError(invoiceError.message);
      setLoading(false);
      return;
    }

    setInvoices((invoiceData || []) as Invoice[]);

    if (invoiceData && invoiceData.length > 0) {
      const invoiceIds = invoiceData.map(
        (invoice) => invoice.id
      );

      const { data: itemData, error: itemError } =
        await supabase
          .from("invoice_items")
          .select(`
            invoice_id,
            description,
            item_type,
            quantity,
            unit_price,
            discount,
            tax,
            line_total,
            service_code
          `)
          .in("invoice_id", invoiceIds);

      if (itemError) {
        setError(itemError.message);
      } else {
        setItems((itemData || []) as InvoiceItem[]);
      }
    }

    setLoading(false);
  };

  const currency = (value: number | null) => {
    return `R ${(value || 0).toFixed(2)}`;
  };

  const formatDate = (value: string | null) => {
    if (!value) return "";

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

  const getItems = (invoiceId: string) => {
    return items.filter(
      (item) => item.invoice_id === invoiceId
    );
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-500">
          Loading billing...
        </p>
      </main>
    );
  }

  if (!patient) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-red-600">
            {error || "Patient not found."}
          </p>
        </div>
      </main>
    );
  }

  const patientName = [
    patient.first_name,
    patient.middle_name,
    patient.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              J&J PRACTICE CLOUD
            </h1>

            <p className="text-sm text-slate-500">
              Patient Billing
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = `/patients/${patientId}`;
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Back to Patient
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              {patient.patient_id}
            </p>

            <h2 className="mt-1 text-3xl font-bold text-slate-900">
              Billing
            </h2>

            <p className="mt-1 text-slate-500">
              {patientName}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = `/patients/${patientId}/billing/new`;
            }}
            className="w-fit rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
          >
            New Invoice
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {invoices.length === 0 ? (
          <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-slate-800">
              No invoices found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              This patient does not have any invoices yet.
            </p>

            <button
              type="button"
              onClick={() => {
                window.location.href = `/patients/${patientId}/billing/new`;
              }}
              className="mt-5 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Create First Invoice
            </button>
          </section>
        ) : (
          <div className="space-y-6">
            {invoices.map((invoice) => {
              const invoiceItems = getItems(invoice.id);

              return (
                <section
                  key={invoice.id}
                  className="rounded-2xl bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-blue-700">
                        {invoice.invoice_number ||
                          "Invoice"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Invoice date:{" "}
                        {formatDate(invoice.invoice_date)}
                      </p>

                      {invoice.due_date && (
                        <p className="mt-1 text-sm text-slate-500">
                          Due date:{" "}
                          {formatDate(invoice.due_date)}
                        </p>
                      )}
                    </div>

                    <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                      {(invoice.status || "unpaid").replace(
                        "_",
                        " "
                      )}
                    </span>
                  </div>

                  {invoiceItems.length > 0 && (
                    <div className="mt-5 overflow-x-auto">
                      <table className="w-full min-w-[600px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                            <th className="px-3 py-3">
                              Description
                            </th>
                            <th className="px-3 py-3">
                              Qty
                            </th>
                            <th className="px-3 py-3">
                              Unit Price
                            </th>
                            <th className="px-3 py-3">
                              Total
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {invoiceItems.map((item, index) => (
                            <tr
                              key={`${invoice.id}-${index}`}
                              className="border-b border-slate-100"
                            >
                              <td className="px-3 py-3">
                                <p className="font-medium text-slate-800">
                                  {item.description}
                                </p>

                                {item.service_code && (
                                  <p className="text-xs text-slate-400">
                                    {item.service_code}
                                  </p>
                                )}
                              </td>

                              <td className="px-3 py-3 text-slate-600">
                                {item.quantity ?? 0}
                              </td>

                              <td className="px-3 py-3 text-slate-600">
                                {currency(item.unit_price)}
                              </td>

                              <td className="px-3 py-3 font-medium text-slate-800">
                                {currency(item.line_total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Summary
                      label="Subtotal"
                      value={currency(invoice.subtotal)}
                    />

                    <Summary
                      label="Discount"
                      value={currency(invoice.discount)}
                    />

                    <Summary
                      label="Tax"
                      value={currency(invoice.tax)}
                    />

                    <Summary
                      label="Total"
                      value={currency(invoice.total)}
                      strong
                    />
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Summary
                      label="Amount Paid"
                      value={currency(invoice.amount_paid)}
                    />

                    <Summary
                      label="Balance"
                      value={currency(invoice.balance)}
                      strong
                    />
                  </div>

                  {invoice.notes && (
                    <div className="mt-5 border-t border-slate-200 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Notes
                      </p>

                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                        {invoice.notes}
                      </p>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Summary({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 ${
          strong
            ? "text-lg font-bold text-slate-900"
            : "font-medium text-slate-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
