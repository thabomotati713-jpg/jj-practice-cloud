"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Product = {
  id: string;
  name: string;
  product_code: string | null;
  unit: string | null;
  current_stock: number | null;
};

type Batch = {
  id: string;
  batch_number: string | null;
  expiry_date: string | null;
  quantity_remaining: number | null;
};

export default function AdjustInventoryPage() {
  const params = useParams();
  const productId = String(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, [productId]);

  const loadData = async () => {
    setLoading(true);
    setError("");

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
      setLoading(false);
      return;
    }

    const practiceId = profile.practice_id;

    const [productResult, batchesResult] = await Promise.all([
      supabase
        .from("inventory_products")
        .select("id, name, product_code, unit, current_stock")
        .eq("id", productId)
        .eq("practice_id", practiceId)
        .single(),

      supabase
        .from("inventory_batches")
        .select("id, batch_number, expiry_date, quantity_remaining")
        .eq("product_id", productId)
        .eq("practice_id", practiceId)
        .order("expiry_date", { ascending: true }),
    ]);

    if (productResult.error || !productResult.data) {
      setError(productResult.error?.message || "Product could not be found.");
      setLoading(false);
      return;
    }

    if (batchesResult.error) {
      setError(batchesResult.error.message);
      setLoading(false);
      return;
    }

    setProduct(productResult.data);
    setBatches(batchesResult.data || []);
    setLoading(false);
  };

  const selectedBatch = batches.find((batch) => batch.id === batchId);

  const handleAdjust = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!batchId) {
      setError("Please select a batch.");
      return;
    }

    const quantity = Number(newQuantity);

    if (!Number.isFinite(quantity) || quantity < 0) {
      setError("Enter a valid quantity of 0 or greater.");
      return;
    }

    if (!reason.trim()) {
      setError("Please provide a reason for the adjustment.");
      return;
    }

    if (!product) {
      setError("Product information is unavailable.");
      return;
    }

    if (!selectedBatch) {
      setError("The selected batch could not be found.");
      return;
    }

    if (quantity === Number(selectedBatch.quantity_remaining || 0)) {
      setError("The new quantity is the same as the current quantity.");
      return;
    }

    setSaving(true);

    try {
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
        throw new Error("Your practice profile could not be found.");
      }

      const { data, error: rpcError } = await supabase.rpc(
        "adjust_inventory_stock",
        {
          p_practice_id: profile.practice_id,
          p_product_id: product.id,
          p_batch_id: batchId,
          p_new_quantity: quantity,
          p_reason: reason.trim(),
          p_performed_by: userData.user.id,
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setSuccess(
        `Stock adjusted successfully. Product stock is now ${Number(
          data?.product_stock ?? 0
        )}.`
      );

      setNewQuantity("");
      setReason("");

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Stock adjustment failed."
      );
    } finally {
      setSaving(false);
    }
  };

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
            <div className="card-body empty-state">
              Loading inventory...
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
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
              <div className="alert-error">
                {error || "Product could not be found."}
              </div>

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
              type="button"
              onClick={() => {
                window.location.href = `/inventory/${productId}`;
              }}
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
            <h1 className="page-title">Adjust {product.name}</h1>
            <p className="page-subtitle">
              Use this when the physical stock count differs from the system
              quantity. Every adjustment is recorded in the stock movement
              history.
            </p>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {success && <div className="alert-success">{success}</div>}

        <div className="stat-grid">
          <div className="stat-card">
            <p className="stat-label">Current Product Stock</p>
            <p className="stat-value">
              {Number(product.current_stock || 0)}
              {product.unit ? ` ${product.unit}` : ""}
            </p>
          </div>

          <div className="stat-card">
            <p className="stat-label">Product Code</p>
            <p className="stat-value">{product.product_code || "—"}</p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Inventory Adjustment</span>
          </div>

          <div className="card-body">
            <form onSubmit={handleAdjust}>
              <div className="field">
                <label
                  className="label"
                  htmlFor="select-batch"
                >
                  Select Batch
                </label>

                <select
                  id="select-batch"
                  value={batchId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setBatchId(id);

                    const batch = batches.find((item) => item.id === id);

                    if (batch) {
                      setNewQuantity(
                        String(Number(batch.quantity_remaining || 0))
                      );
                    } else {
                      setNewQuantity("");
                    }
                  }}
                  className="input"
                >
                  <option value="">Select a batch</option>

                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batch_number || "Unnamed batch"} —{" "}
                      {Number(batch.quantity_remaining || 0)} remaining
                      {batch.expiry_date
                        ? ` — Exp ${batch.expiry_date}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBatch && (
                <div className="stat-card">
                  <p className="stat-label">Current batch quantity</p>
                  <p className="stat-value">
                    {Number(selectedBatch.quantity_remaining || 0)}
                  </p>
                </div>
              )}

              <div className="field">
                <label
                  className="label"
                  htmlFor="new-quantity"
                >
                  New Physical Quantity
                </label>

                <input
                  id="new-quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={newQuantity}
                  onChange={(event) => setNewQuantity(event.target.value)}
                  placeholder="Enter the actual quantity counted"
                  className="input"
                />

                <p className="page-subtitle">
                  Enter the quantity you physically counted for this batch.
                </p>
              </div>

              <div className="field">
                <label
                  className="label"
                  htmlFor="adjust-reason"
                >
                  Reason
                </label>

                <textarea
                  id="adjust-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={4}
                  placeholder="Example: Physical stock count found 122 units."
                  className="input"
                />
              </div>

              <div className="alert-info">
                <strong>Important:</strong> This changes both the selected
                batch quantity and the overall product stock. The adjustment
                will also be recorded in Stock Movement History.
              </div>

              <div className="page-actions sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `/inventory/${productId}`;
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
                  {saving ? "Saving Adjustment..." : "Save Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
