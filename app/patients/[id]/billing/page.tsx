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

const statusVariant = (status: string | null) => {
  const value = (status || "").toLowerCase().replace("_", " ");

  if (["paid", "completed", "active", "in stock"].includes(value)) {
    return "badge badge-green";
  }

  if (
    ["pending", "submitted", "partially paid", "scheduled", "confirmed"].includes(
      value
    )
  ) {
    return "badge badge-blue";
  }

  if (["low stock", "no show"].includes(value)) {
    return "badge badge-amber";
  }

  if (["cancelled", "rejected", "overdue", "out of stock"].includes(value)) {
    return "badge badge-red";
  }

  return "badge badge-gray";
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
      <main className="page-shell">
        <div className="page-inner">
          <p className="empty-state">Loading billing...</p>
        </div>
      </main>
    );
  }

  if (!patient) {
    return (
      <main className="page-shell">
        <div className="page-inner">
          <div className="alert-error">
            {error || "Patient not found."}
          </div>
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

          <a
            href={`/patients/${patientId}`}
            className="btn btn-secondary btn-sm"
          >
            Back to Patient
          </a>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Billing</h1>

            <p className="page-subtitle">
              {patient.patient_id} &middot; {patientName}
            </p>
          </div>

          <div className="page-actions">
            <a
              href={`/patients/${patientId}/billing/new`}
              className="btn btn-primary"
            >
              New Invoice
            </a>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {invoices.length === 0 ? (
          <div className="empty-state">
            <p>
              <strong>No invoices found</strong>
            </p>

            <p>This patient does not have any invoices yet.</p>

            <p className="mt-5">
              <a
                href={`/patients/${patientId}/billing/new`}
                className="btn btn-primary"
              >
                Create First Invoice
              </a>
            </p>
          </div>
        ) : (
          <div>
            {invoices.map((invoice) => {
              const invoiceItems = getItems(invoice.id);

              return (
                <section key={invoice.id} className="card">
                  <div className="card-header">
                    <div>
                      <span className="card-title">
                        {invoice.invoice_number ||
                          "Invoice"}
                      </span>

                      <p className="page-subtitle">
                        Invoice date:{" "}
                        {formatDate(invoice.invoice_date)}
                      </p>

                      {invoice.due_date && (
                        <p className="page-subtitle">
                          Due date:{" "}
                          {formatDate(invoice.due_date)}
                        </p>
                      )}
                    </div>

                    <span
                      className={statusVariant(
                        invoice.status
                      )}
                    >
                      {(invoice.status || "unpaid").replace(
                        "_",
                        " "
                      )}
                    </span>
                  </div>

                  <div className="card-body">
                    {invoiceItems.length > 0 && (
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>
                                Description
                              </th>
                              <th>
                                Qty
                              </th>
                              <th>
                                Unit Price
                              </th>
                              <th>
                                Total
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {invoiceItems.map((item, index) => (
                              <tr
                                key={`${invoice.id}-${index}`}
                              >
                                <td>
                                  <p>
                                    {item.description}
                                  </p>

                                  {item.service_code && (
                                    <p className="page-subtitle">
                                      {item.service_code}
                                    </p>
                                  )}
                                </td>

                                <td>
                                  {item.quantity ?? 0}
                                </td>

                                <td>
                                  {currency(item.unit_price)}
                                </td>

                                <td>
                                  {currency(item.line_total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="stat-grid">
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

                    <div className="stat-grid">
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
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <p className="stat-label">
                          Notes
                        </p>

                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {invoice.notes}
                        </p>
                      </div>
                    )}
                  </div>
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
    <div className="stat-card">
      <p className="stat-label">
        {label}
      </p>

      <p
        className={`stat-value ${
          strong
            ? ""
            : "text-base font-semibold"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
