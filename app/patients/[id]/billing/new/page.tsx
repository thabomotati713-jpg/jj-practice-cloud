"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";

type Patient = {
  id: string;
  patient_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

type InvoiceItem = {
  id: string;
  description: string;
  item_type: string;
  quantity: string;
  unit_price: string;
  discount: string;
  tax: string;
  service_code: string;
};

export default function NewInvoicePage() {
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState("");
  const [amountPaid, setAmountPaid] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: crypto.randomUUID(),
      description: "",
      item_type: "service",
      quantity: "1",
      unit_price: "",
      discount: "0",
      tax: "0",
      service_code: "",
    },
  ]);

  useEffect(() => {
    loadPatient();
  }, [patientId]);

  const loadPatient = async () => {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("patients")
      .select(
        "id, patient_id, first_name, middle_name, last_name"
      )
      .eq("id", patientId)
      .single();

    if (error || !data) {
      setError("Patient could not be found.");
    } else {
      setPatient(data as Patient);
    }

    setLoading(false);
  };

  const updateItem = (
    id: string,
    field: keyof InvoiceItem,
    value: string
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        description: "",
        item_type: "service",
        quantity: "1",
        unit_price: "",
        discount: "0",
        tax: "0",
        service_code: "",
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((item) => item.id !== id);
    });
  };

  const calculateItem = (item: InvoiceItem) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    const discount = Number(item.discount) || 0;
    const tax = Number(item.tax) || 0;

    const gross = quantity * unitPrice;
    const afterDiscount = Math.max(gross - discount, 0);
    const lineTotal = afterDiscount + tax;

    return {
      gross,
      discount,
      tax,
      lineTotal,
    };
  };

  const subtotal = items.reduce((sum, item) => {
    return sum + calculateItem(item).gross;
  }, 0);

  const totalDiscount = items.reduce((sum, item) => {
    return sum + calculateItem(item).discount;
  }, 0);

  const totalTax = items.reduce((sum, item) => {
    return sum + calculateItem(item).tax;
  }, 0);

  const total = items.reduce((sum, item) => {
    return sum + calculateItem(item).lineTotal;
  }, 0);

  const paid = Number(amountPaid) || 0;
  const balance = Math.max(total - paid, 0);

  const generateInvoiceNumber = () => {
    return `INV-${Date.now().toString().slice(-8)}`;
  };

  const handleSave = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setError("");

    const validItems = items.filter(
      (item) =>
        item.description.trim() &&
        Number(item.quantity) > 0 &&
        Number(item.unit_price) >= 0
    );

    if (validItems.length === 0) {
      setError(
        "Please add at least one invoice item with a description and price."
      );
      return;
    }

    setSaving(true);

    const { data: userData } =
      await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("practice_id")
        .eq("id", userData.user.id)
        .single();

    if (profileError || !profile) {
      setError(
        "Your practice profile could not be found."
      );
      setSaving(false);
      return;
    }

    const invoiceNumber = generateInvoiceNumber();

    const { data: invoice, error: invoiceError } =
      await supabase
        .from("invoices")
        .insert({
          practice_id: profile.practice_id,
          patient_id: patientId,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          subtotal,
          discount: totalDiscount,
          tax: totalTax,
          total,
          amount_paid: paid,
          balance,
          payment_method:
            paymentMethod.trim() || null,
          status:
            balance <= 0
              ? "paid"
              : paid > 0
                ? "partially_paid"
                : "unpaid",
          notes: notes.trim() || null,
          created_by: userData.user.id,
        })
        .select("id")
        .single();

    if (invoiceError || !invoice) {
      setError(
        invoiceError?.message ||
          "The invoice could not be created."
      );
      setSaving(false);
      return;
    }

    const itemRows = validItems.map((item) => {
      const calculated = calculateItem(item);

      return {
        invoice_id: invoice.id,
        description: item.description.trim(),
        item_type: item.item_type || "service",
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        discount: calculated.discount,
        tax: calculated.tax,
        line_total: calculated.lineTotal,
        service_code:
          item.service_code.trim() || null,
      };
    });

    const { error: itemsError } =
      await supabase
        .from("invoice_items")
        .insert(itemRows);

    if (itemsError) {
      await supabase
        .from("invoices")
        .delete()
        .eq("id", invoice.id);

      setError(itemsError.message);
      setSaving(false);
      return;
    }

    window.location.href = `/patients/${patientId}/billing`;
  };

  const currency = (value: number) =>
    `R ${value.toFixed(2)}`;

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-inner">
          <p className="empty-state">Loading patient...</p>
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
            href={`/patients/${patientId}/billing`}
            className="btn btn-secondary btn-sm"
          >
            Back to Billing
          </a>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">New Invoice</h1>

            <p className="page-subtitle">
              {patient.patient_id} &middot; Patient: {patientName}
            </p>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <form
          onSubmit={handleSave}
          className="space-y-6"
        >
          <section className="card">
            <div className="card-header">
              <h3 className="card-title">
                Invoice Details
              </h3>
            </div>

            <div className="card-body">
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="Invoice date"
                  type="date"
                  value={invoiceDate}
                  onChange={setInvoiceDate}
                />

                <Input
                  label="Due date"
                  type="date"
                  value={dueDate}
                  onChange={setDueDate}
                />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  Invoice Items
                </h3>

                <p className="page-subtitle">
                  Add services, products, or other charges.
                </p>
              </div>

              <button
                type="button"
                onClick={addItem}
                className="btn btn-primary btn-sm"
              >
                + Add Item
              </button>
            </div>

            <div className="card-body">
              <div className="space-y-5">
                {items.map((item, index) => {
                  const calculated =
                    calculateItem(item);

                  return (
                    <div
                      key={item.id}
                      className="card"
                    >
                      <div className="card-header">
                        <p className="card-title">
                          Item {index + 1}
                        </p>

                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              removeItem(item.id)
                            }
                            className="btn btn-danger btn-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="card-body">
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="sm:col-span-2">
                            <Input
                              label="Description"
                              value={item.description}
                              onChange={(value) =>
                                updateItem(
                                  item.id,
                                  "description",
                                  value
                                )
                              }
                              placeholder="e.g. Consultation"
                            />
                          </div>

                          <Input
                            label="Service code"
                            value={item.service_code}
                            onChange={(value) =>
                              updateItem(
                                item.id,
                                "service_code",
                                value
                              )
                            }
                            placeholder="Optional"
                          />

                          <div className="field">
                            <label className="label">
                              Item type
                            </label>

                            <select
                              value={item.item_type}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  "item_type",
                                  e.target.value
                                )
                              }
                              className="input"
                            >
                              <option value="service">
                                Service
                              </option>
                              <option value="product">
                                Product
                              </option>
                              <option value="procedure">
                                Procedure
                              </option>
                              <option value="other">
                                Other
                              </option>
                            </select>
                          </div>

                          <Input
                            label="Quantity"
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(value) =>
                              updateItem(
                                item.id,
                                "quantity",
                                value
                              )
                            }
                          />

                          <Input
                            label="Unit price (R)"
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(value) =>
                              updateItem(
                                item.id,
                                "unit_price",
                                value
                              )
                            }
                          />

                          <Input
                            label="Discount (R)"
                            type="number"
                            step="0.01"
                            value={item.discount}
                            onChange={(value) =>
                              updateItem(
                                item.id,
                                "discount",
                                value
                              )
                            }
                          />

                          <Input
                            label="Tax (R)"
                            type="number"
                            step="0.01"
                            value={item.tax}
                            onChange={(value) =>
                              updateItem(
                                item.id,
                                "tax",
                                value
                              )
                            }
                          />
                        </div>

                        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-right">
                          <span className="text-sm text-slate-500">
                            Line total
                          </span>

                          <span className="ml-3 font-bold text-slate-900">
                            {currency(
                              calculated.lineTotal
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h3 className="card-title">
                Payment
              </h3>
            </div>

            <div className="card-body">
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="Amount paid (R)"
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={setAmountPaid}
                />

                <div className="field">
                  <label className="label">
                    Payment method
                  </label>

                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value)
                    }
                    className="input"
                  >
                    <option value="">
                      Select payment method
                    </option>
                    <option value="cash">
                      Cash
                    </option>
                    <option value="card">
                      Card
                    </option>
                    <option value="eft">
                      EFT
                    </option>
                    <option value="medical_aid">
                      Medical Aid
                    </option>
                    <option value="other">
                      Other
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h3 className="card-title">
                Notes
              </h3>
            </div>

            <div className="card-body">
              <textarea
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value)
                }
                rows={4}
                placeholder="Additional invoice notes..."
                className="input"
              />
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h3 className="card-title">
                Invoice Summary
              </h3>
            </div>

            <div className="card-body">
              <div className="space-y-3">
                <Summary
                  label="Subtotal"
                  value={currency(subtotal)}
                />

                <Summary
                  label="Discount"
                  value={currency(totalDiscount)}
                />

                <Summary
                  label="Tax"
                  value={currency(totalTax)}
                />

                <div className="border-t border-slate-200 pt-3">
                  <Summary
                    label="Total"
                    value={currency(total)}
                    strong
                  />
                </div>

                <Summary
                  label="Amount Paid"
                  value={currency(paid)}
                />

                <Summary
                  label="Balance"
                  value={currency(balance)}
                  strong
                />
              </div>
            </div>
          </section>

          <div className="page-actions sm:justify-end">
            <button
              type="button"
              onClick={() => {
                window.location.href = `/patients/${patientId}/billing`;
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving
                ? "Saving Invoice..."
                : "Save Invoice"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
}) {
  return (
    <div className="field">
      <label className="label">
        {label}
      </label>

      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        className="input"
      />
    </div>
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
    <div className="flex items-center justify-between gap-4">
      <span
        className={
          strong
            ? "font-semibold text-slate-900"
            : "text-sm text-slate-500"
        }
      >
        {label}
      </span>

      <span
        className={
          strong
            ? "text-lg font-bold text-slate-900"
            : "font-medium text-slate-700"
        }
      >
        {value}
      </span>
    </div>
  );
}
