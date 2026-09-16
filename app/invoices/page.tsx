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
      window.location.href = "/login";
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
    <main className="page-shell">
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
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Invoices</h1>
            <p className="page-subtitle">
              Practice-wide billing and outstanding balances
            </p>
          </div>
          <div className="page-actions" />
        </div>

        {error && (
          <div className="alert-error">{error}</div>
        )}

        <div className="stat-grid">
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
          <div className="card">
            <div className="empty-state">
              Loading invoices...
            </div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <p className="font-semibold">
                No invoices found
              </p>

              <p className="mt-1">
                Invoices created from patient billing will
                appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>

                  <th>Patient</th>

                  <th>Date</th>

                  <th>Total</th>

                  <th>Paid</th>

                  <th>Balance</th>

                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
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
                    <tr key={invoice.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href =
                              `/invoices/${invoice.id}`;
                          }}
                          className="font-semibold hover:underline"
                        >
                          {invoice.invoice_number ||
                            "Invoice"}
                        </button>
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href =
                              `/patients/${invoice.patient_id}/billing`;
                          }}
                          className="text-left"
                        >
                          <p className="font-medium">
                            {patientName}
                          </p>

                          <p className="text-xs text-slate-400">
                            {patient?.patient_id ||
                              invoice.patient_id}
                          </p>
                        </button>
                      </td>

                      <td className="text-sm text-slate-600">
                        {formatDate(
                          invoice.invoice_date
                        )}
                      </td>

                      <td className="font-medium">
                        {currency(invoice.total)}
                      </td>

                      <td className="text-sm text-slate-600">
                        {currency(
                          invoice.amount_paid
                        )}
                      </td>

                      <td className="font-semibold">
                        {currency(invoice.balance)}
                      </td>

                      <td>
                        <span
                          className={statusBadgeClass(
                            invoice.status
                          )}
                        >
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
    <div className="stat-card">
      <p className="stat-label">{label}</p>

      <p className="stat-value">{value}</p>
    </div>
  );
}
