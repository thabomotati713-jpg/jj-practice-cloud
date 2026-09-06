"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Invoice = {
  id: string;
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
};

type Patient = {
  id: string;
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/";
      return;
    }

    const { data: invoiceData, error: invoiceError } =
      await supabase
        .from("invoices")
        .select(`
          id,
          patient_id,
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
          status
        `)
        .order("invoice_date", { ascending: false });

    if (invoiceError) {
      setError(invoiceError.message);
      setLoading(false);
      return;
    }

    const loadedInvoices = (invoiceData || []) as Invoice[];
    setInvoices(loadedInvoices);

    const patientIds = [
      ...new Set(
        loadedInvoices.map((invoice) => invoice.patient_id)
      ),
    ];

    if (patientIds.length > 0) {
      const { data: patientData, error: patientError } =
        await supabase
          .from("patients")
          .select(
            "id, patient_id, first_name, last_name"
          )
          .in("id", patientIds);

      if (patientError) {
        setError(patientError.message);
      } else {
        setPatients((patientData || []) as Patient[]);
      }
    }

    setLoading(false);
  };

  const currency = (value: number | null) =>
    `R ${(value || 0).toFixed(2)}`;

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

  const getPatient = (patientId: string) => {
    return patients.find(
      (patient) => patient.id === patientId
    );
  };

  const totalInvoiced = invoices.reduce(
    (sum, invoice) => sum + (invoice.total || 0),
    0
  );

  const totalPaid = invoices.reduce(
    (sum, invoice) =>
      sum + (invoice.amount_paid || 0),
    0
  );

  const totalOutstanding = invoices.reduce(
    (sum, invoice) =>
      sum + (invoice.balance || 0),
    0
  );

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              J&J PRACTICE CLOUD
            </h1>

            <p className="text-sm text-slate-500">
              Invoices
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Dashboard
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">
            Invoices
          </h2>

          <p className="mt-1 text-slate-500">
            Practice-wide billing and outstanding balances
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Total Invoiced"
            value={currency(totalInvoiced)}
          />

          <SummaryCard
            label="Total Paid"
            value={currency(totalPaid)}
          />

          <SummaryCard
            label="Outstanding"
            value={currency(totalOutstanding)}
          />
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-slate-500">
              Loading invoices...
            </p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-slate-800">
              No invoices found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Invoices created from patient billing will
              appear here.
            </p>
          </div>
        ) : (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-4">
                      Invoice
                    </th>

                    <th className="px-5 py-4">
                      Patient
                    </th>

                    <th className="px-5 py-4">
                      Date
                    </th>

                    <th className="px-5 py-4">
                      Total
                    </th>

                    <th className="px-5 py-4">
                      Paid
                    </th>

                    <th className="px-5 py-4">
                      Balance
                    </th>

                    <th className="px-5 py-4">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {invoices.map((invoice) => {
                    const patient = getPatient(
                      invoice.patient_id
                    );

                    const patientName = patient
                      ? [
                          patient.first_name,
                          patient.last_name,
                        ]
                          .filter(Boolean)
                          .join(" ")
                      : "Unknown patient";

                    return (
                      <tr
                        key={invoice.id}
                        className="hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              window.location.href =
                                `/invoices/${invoice.id}`;
                            }}
                            className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                          >
                            {invoice.invoice_number ||
                              "Invoice"}
                          </button>
                        </td>

                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              window.location.href =
                                `/patients/${invoice.patient_id}/billing`;
                            }}
                            className="text-left"
                          >
                            <p className="font-medium text-slate-800">
                              {patientName}
                            </p>

                            <p className="text-xs text-slate-400">
                              {patient?.patient_id ||
                                invoice.patient_id}
                            </p>
                          </button>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatDate(
                            invoice.invoice_date
                          )}
                        </td>

                        <td className="px-5 py-4 font-medium text-slate-800">
                          {currency(invoice.total)}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {currency(
                            invoice.amount_paid
                          )}
                        </td>

                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {currency(invoice.balance)}
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                            {(invoice.status ||
                              "unpaid").replace(
                              "_",
                              " "
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}
