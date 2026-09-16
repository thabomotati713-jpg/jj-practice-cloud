"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
  fetchMySpecialty,
  getSpecialty,
  type SpecialtyConfig,
} from "../../../lib/specialties";

export default function NewInventoryProductPage() {
  const [specialtyConfig, setSpecialtyConfig] = useState<SpecialtyConfig>(
    getSpecialty("general")
  );

  useEffect(() => {
    fetchMySpecialty(supabase, supabase).then(setSpecialtyConfig);
  }, []);
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
    <main className="page-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <a href="/dashboard" className="app-brand">
            <img
              src="/logo.jpg"
              alt="J&J Practice Cloud"
              className="app-brand-logo"
            />
            <span className="app-brand-name">J&J Practice Cloud</span>
          </a>

          <div className="page-actions">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/inventory";
              }}
              className="btn btn-secondary btn-sm"
            >
              Back to Inventory
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Add Product</h1>
            <p className="page-subtitle">
              Add a medicine or other inventory product.
            </p>
          </div>
        </div>

        {error && (
          <div className="alert-error">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <section className="card">
            <div className="card-header">
              <h3 className="card-title">Product Information</h3>
            </div>

            <div className="card-body">
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

                <label className="field" htmlFor="field-category">
                  <span className="label">Category</span>
                  <input
                    id="field-category"
                    type="text"
                    list="category-presets"
                    value={form.category}
                    onChange={(event) =>
                      updateField("category", event.target.value)
                    }
                    placeholder={`e.g. ${specialtyConfig.inventoryCategories[0]}`}
                    className="input"
                  />
                  <datalist id="category-presets">
                    {specialtyConfig.inventoryCategories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </label>

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
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h3 className="card-title">Pricing &amp; Stock</h3>
            </div>

            <div className="card-body">
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
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h3 className="card-title">Product Settings</h3>
            </div>

            <div className="card-body">
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
            </div>
          </section>

          <div className="page-actions flex-col-reverse sm:justify-end">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/inventory";
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
  const id = `field-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;

  return (
    <label className="field" htmlFor={id}>
      <span className="label">{label}</span>

      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input"
      />
    </label>
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
  const id = `field-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;

  return (
    <label className="field" htmlFor={id}>
      <span className="label">{label}</span>

      <input
        id={id}
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input"
      />
    </label>
  );
}
