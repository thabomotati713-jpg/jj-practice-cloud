"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  generic_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  unit: string | null;
  current_stock: number | null;
  purchase_price: number | null;
};

export default function ReceiveStockPage() {
  const params = useParams();
  const router = useRouter();
  const productId = String(params.id);

  const [product, setProduct] = useState<Product | null>(null);

  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [receivedDate, setReceivedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [supplier, setSupplier] = useState("");
  const [reason, setReason] = useState("Stock received");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [productId]);

  async function loadData() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.practice_id) {
      setError("Could not determine the practice.");
      setLoading(false);
      return;
    }

    const { data: productData, error: productError } = await supabase
      .from("inventory_products")
      .select(
        "id, name, generic_name, strength, dosage_form, unit, current_stock, purchase_price"
      )
      .eq("id", productId)
      .eq("practice_id", profile.practice_id)
      .single();

    if (productError) {
      setError(productError.message);
      setLoading(false);
      return;
    }

    setProduct(productData);
    setPurchasePrice(
      productData.purchase_price !== null
        ? String(productData.purchase_price)
        : ""
    );

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!product) {
      setError("Product information is unavailable.");
      return;
    }

    const cleanBatchNumber = batchNumber.trim();
    const qty = Number(quantity);
    const price = Number(purchasePrice);

    if (!cleanBatchNumber) {
      setError("Batch number is required.");
      return;
    }

    if (!expiryDate) {
      setError("Expiry date is required.");
      return;
    }

    if (expiryDate < new Date().toISOString().slice(0, 10)) {
      setError("Cannot receive stock with an expired batch.");
      return;
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setError("Purchase price cannot be negative.");
      return;
    }

    if (!receivedDate) {
      setError("Received date is required.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.practice_id) {
      setError("Could not determine the practice.");
      setSaving(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc(
      "receive_inventory_stock",
      {
        p_practice_id: profile.practice_id,
        p_product_id: product.id,
        p_batch_number: cleanBatchNumber,
        p_expiry_date: expiryDate,
        p_quantity: qty,
        p_purchase_price: price,
        p_received_date: receivedDate,
        p_supplier: supplier.trim() || null,
        p_reason: reason.trim() || "Stock received",
        p_performed_by: user.id,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setSaving(false);
      return;
    }

    setMessage(
      `Stock received successfully. New stock: ${Number(
        data?.new_stock ?? Number(product.current_stock || 0) + qty
      ).toFixed(2)}${product.unit ? ` ${product.unit}` : ""}.`
    );

    setTimeout(() => {
      router.push(`/inventory/${product.id}`);
    }, 900);
  }

  if (loading) {
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
          </div>
        </header>

        <div className="page-inner">
          <div className="card">
            <div className="card-body">
              <p className="page-subtitle">Loading...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

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
              onClick={() => router.push("/dashboard")}
              className="btn btn-secondary btn-sm"
            >
              Dashboard
            </button>

            <button
              onClick={() => router.push(`/inventory/${productId}`)}
              className="btn btn-secondary btn-sm"
            >
              Back to Product
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Receive Stock</h1>
            <p className="page-subtitle">
              Add stock to the selected product and create a stock movement.
            </p>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {message && <div className="alert-success">{message}</div>}

        {product && (
          <div className="stat-grid">
            <div className="stat-card">
              <p className="stat-label">{product.name}</p>
              <p className="stat-value">
                {Number(product.current_stock || 0).toFixed(2)}
                {product.unit ? ` ${product.unit}` : ""}
              </p>
              <p className="page-subtitle">
                {product.generic_name || ""}
                {product.strength ? ` • ${product.strength}` : ""}
                {product.dosage_form ? ` • ${product.dosage_form}` : ""}
              </p>
            </div>

            <div className="stat-card">
              <p className="stat-label">Current Stock</p>
              <p className="stat-value">
                {Number(product.current_stock || 0).toFixed(2)}
                {product.unit ? ` ${product.unit}` : ""}
              </p>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <span className="card-title">Receive Stock</span>
          </div>

          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <Field
                label="Batch Number"
                value={batchNumber}
                onChange={setBatchNumber}
                placeholder="e.g. PND-002"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="field">
                  <label
                    className="label"
                    htmlFor="expiry-date"
                  >
                    Expiry Date
                  </label>

                  <input
                    id="expiry-date"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    required
                    className="input"
                  />
                </div>

                <NumberField
                  label="Quantity Received"
                  value={quantity}
                  onChange={setQuantity}
                  step="0.01"
                />

                <NumberField
                  label="Purchase Price"
                  value={purchasePrice}
                  onChange={setPurchasePrice}
                  step="0.01"
                />

                <div className="field">
                  <label
                    className="label"
                    htmlFor="received-date"
                  >
                    Received Date
                  </label>

                  <input
                    id="received-date"
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    required
                    className="input"
                  />
                </div>
              </div>

              <Field
                label="Supplier"
                value={supplier}
                onChange={setSupplier}
                placeholder="Optional supplier name"
              />

              <div className="field">
                <label className="label" htmlFor="reason-notes">
                  Reason / Notes
                </label>

                <textarea
                  id="reason-notes"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="input"
                  placeholder="Stock received"
                />
              </div>

              <div className="page-actions sm:justify-end">
                <button
                  type="button"
                  onClick={() => router.push(`/inventory/${productId}`)}
                  disabled={saving}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? "Receiving Stock..." : "Receive Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
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
    <div className="field">
      <label className="label">{label}</label>

      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}) {
  return (
    <div className="field">
      <label className="label">{label}</label>

      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input"
      />
    </div>
  );
}
