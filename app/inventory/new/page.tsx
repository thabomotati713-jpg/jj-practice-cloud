"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function NewInventoryProductPage() {
  const [form, setForm] = useState({
    product_code: "",
    barcode: "",
    name: "",
    generic_name: "",
    category: "",
    strength: "",
    dosage_form: "",
    manufacturer: "",
    unit: "",
    purchase_price: "",
    selling_price: "",
    current_stock: "",
    minimum_stock: "",
    prescription_required: false,
    active: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateField = (
    field: keyof typeof form,
    value: string | boolean
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setError("");

    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }

    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      setError("Your practice profile could not be found.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("inventory_products")
      .insert({
        practice_id: profile.practice_id,
        product_code: form.product_code.trim() || null,
        barcode: form.barcode.trim() || null,
        name: form.name.trim(),
        generic_name: form.generic_name.trim() || null,
        category: form.category.trim() || null,
        strength: form.strength.trim() || null,
        dosage_form: form.dosage_form.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        unit: form.unit.trim() || null,
        purchase_price: Number(form.purchase_price || 0),
        selling_price: Number(form.selling_price || 0),
        current_stock: Number(form.current_stock || 0),
        minimum_stock: Number(form.minimum_stock || 0),
        prescription_required: form.prescription_required,
        active: form.active,
      });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    window.location.href = "/inventory";
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              J&J PRACTICE CLOUD
            </h1>
            <p className="text-sm text-slate-500">
              Inventory & Stock Management
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/inventory";
            }}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Back to Inventory
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">
            Add Product
          </h2>
          <p className="mt-1 text-slate-500">
            Add a medicine or other inventory product.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-lg font-bold text-slate-900">
              Product Information
            </h3>

            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Product Name *"
                value={form.name}
                onChange={(value) => updateField("name", value)}
                placeholder="e.g. Panado"
              />

              <Field
                label="Generic Name"
                value={form.generic_name}
                onChange={(value) =>
                  updateField("generic_name", value)
                }
                placeholder="e.g. Paracetamol"
              />

              <Field
                label="Product Code"
                value={form.product_code}
                onChange={(value) =>
                  updateField("product_code", value)
                }
                placeholder="e.g. MED-0001"
              />

              <Field
                label="Barcode"
                value={form.barcode}
                onChange={(value) => updateField("barcode", value)}
                placeholder="Barcode number"
              />

              <Field
                label="Category"
                value={form.category}
                onChange={(value) => updateField("category", value)}
                placeholder="e.g. Analgesic"
              />

              <Field
                label="Strength"
                value={form.strength}
                onChange={(value) => updateField("strength", value)}
                placeholder="e.g. 500 mg"
              />

              <Field
                label="Dosage Form"
                value={form.dosage_form}
                onChange={(value) =>
                  updateField("dosage_form", value)
                }
                placeholder="e.g. Tablet"
              />

              <Field
                label="Manufacturer"
                value={form.manufacturer}
                onChange={(value) =>
                  updateField("manufacturer", value)
                }
                placeholder="Manufacturer"
              />

              <Field
                label="Unit"
                value={form.unit}
                onChange={(value) => updateField("unit", value)}
                placeholder="e.g. tablets, bottles, boxes"
              />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-lg font-bold text-slate-900">
              Pricing & Stock
            </h3>

            <div className="grid gap-5 md:grid-cols-2">
              <NumberField
                label="Purchase Price (R)"
                value={form.purchase_price}
                onChange={(value) =>
                  updateField("purchase_price", value)
                }
                step="0.01"
              />

              <NumberField
                label="Selling Price (R)"
                value={form.selling_price}
                onChange={(value) =>
                  updateField("selling_price", value)
                }
                step="0.01"
              />

              <NumberField
                label="Current Stock"
                value={form.current_stock}
                onChange={(value) =>
                  updateField("current_stock", value)
                }
                step="1"
              />

              <NumberField
                label="Minimum Stock Level"
                value={form.minimum_stock}
                onChange={(value) =>
                  updateField("minimum_stock", value)
                }
                step="1"
              />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-lg font-bold text-slate-900">
              Product Settings
            </h3>

            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.prescription_required}
                  onChange={(event) =>
                    updateField(
                      "prescription_required",
                      event.target.checked
                    )
                  }
                  className="h-4 w-4"
                />

                <span className="text-sm font-medium text-slate-700">
                  Prescription required
                </span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    updateField("active", event.target.checked)
                  }
                  className="h-4 w-4"
                />

                <span className="text-sm font-medium text-slate-700">
                  Product is active
                </span>
              </label>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/inventory";
              }}
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Product"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
      />
    </div>
  );
}
