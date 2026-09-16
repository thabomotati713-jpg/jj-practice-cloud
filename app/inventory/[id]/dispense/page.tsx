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
  current_stock: number;
};

type Batch = {
  id: string;
  batch_number: string;
  expiry_date: string;
  quantity_remaining: number;
};

export default function DispenseStockPage() {
  const params = useParams();
  const router = useRouter();
  const productId = String(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
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
      router.push("/");
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
        "id, name, generic_name, strength, dosage_form, unit, current_stock"
      )
      .eq("id", productId)
      .eq("practice_id", profile.practice_id)
      .single();

    if (productError) {
      setError(productError.message);
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const { data: batchData, error: batchError } = await supabase
      .from("inventory_batches")
      .select("id, batch_number, expiry_date, quantity_remaining")
      .eq("product_id", productId)
      .eq("practice_id", profile.practice_id)
      .gt("quantity_remaining", 0)
      .gte("expiry_date", today)
      .order("expiry_date", { ascending: true })
      .order("received_date", { ascending: true });

    if (batchError) {
      setError(batchError.message);
      setLoading(false);
      return;
    }

    setProduct(productData);
    setBatches(batchData || []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMessage("");
    setError("");

    const qty = Number(quantity);

    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Please enter a valid quantity greater than zero.");
      return;
    }

    if (!product) {
      setError("Product information is unavailable.");
      return;
    }

    if (qty > Number(product.current_stock)) {
      setError("Cannot dispense more than the current stock.");
      return;
    }

    const availableBatchStock = batches.reduce(
      (total, batch) => total + Number(batch.quantity_remaining || 0),
      0
    );

    if (qty > availableBatchStock) {
      setError(
        `Not enough non-expired batch stock available. Available: ${availableBatchStock.toFixed(
          2
        )}.`
      );
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
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
      "dispense_inventory_stock",
      {
        p_practice_id: profile.practice_id,
        p_product_id: product.id,
        p_quantity: qty,
        p_reason: reason.trim() || "Stock dispensed",
        p_performed_by: user.id,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setSaving(false);
      return;
    }

    const newStock = Number(
      data?.new_stock ?? Number(product.current_stock) - qty
    );

    setMessage(
      `Stock dispensed successfully. New stock: ${newStock.toFixed(2)}${
        product.unit ? ` ${product.unit}` : ""
      }.`
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
            <h1 className="page-title">Dispense Stock</h1>
            <p className="page-subtitle">
              Stock is automatically issued using first-expiry-first-out.
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
                {Number(product.current_stock).toFixed(2)}
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
                {Number(product.current_stock).toFixed(2)}
                {product.unit ? ` ${product.unit}` : ""}
              </p>
            </div>

            <div className="stat-card">
              <p className="stat-label">
                Available Non-Expired Batch Stock
              </p>
              <p className="stat-value">
                {batches
                  .reduce(
                    (total, batch) =>
                      total + Number(batch.quantity_remaining || 0),
                    0
                  )
                  .toFixed(2)}
                {product.unit ? ` ${product.unit}` : ""}
              </p>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <span className="card-title">Dispense Stock</span>
          </div>

          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label
                  className="label"
                  htmlFor="dispense-quantity"
                >
                  Quantity to Dispense
                </label>

                <input
                  id="dispense-quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  disabled={saving}
                  className="input"
                  placeholder="Enter quantity"
                />
              </div>

              <div className="field">
                <label
                  className="label"
                  htmlFor="dispense-reason"
                >
                  Reason / Notes
                </label>

                <textarea
                  id="dispense-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  disabled={saving}
                  className="input"
                  placeholder="Optional"
                />
              </div>

              <div className="field">
                <h3 className="card-title">
                  Available Batches — FEFO Order
                </h3>

                {batches.length === 0 ? (
                  <div className="empty-state">
                    No non-expired batches with available stock.
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Batch</th>
                          <th>Expiry</th>
                          <th>Available</th>
                        </tr>
                      </thead>

                      <tbody>
                        {batches.map((batch) => {
                          const expiry = new Date(
                            `${batch.expiry_date}T00:00:00`
                          );

                          const today = new Date();
                          const daysUntilExpiry = Math.ceil(
                            (expiry.getTime() -
                              new Date(
                                today.getFullYear(),
                                today.getMonth(),
                                today.getDate()
                              ).getTime()) /
                              (1000 * 60 * 60 * 24)
                          );

                          return (
                            <tr key={batch.id}>
                              <td>
                                <strong>{batch.batch_number}</strong>
                              </td>

                              <td>
                                {batch.expiry_date}
                                {daysUntilExpiry <= 30 && (
                                  <span className="badge badge-amber">
                                    Expires soon
                                  </span>
                                )}
                              </td>

                              <td>
                                {Number(
                                  batch.quantity_remaining
                                ).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="page-actions sm:justify-end">
                <button
                  type="submit"
                  disabled={saving || batches.length === 0}
                  className="btn btn-primary"
                >
                  {saving ? "Dispensing..." : "Dispense Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
