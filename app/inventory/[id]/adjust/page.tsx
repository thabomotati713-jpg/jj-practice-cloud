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
      <main className="min-h-screen bg-slate-100">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-slate-500">Loading inventory...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-slate-100">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="font-semibold text-red-700">
              {error || "Product could not be found."}
            </p>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/inventory";
              }}
              className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              Back to Inventory
            </button>
          </div>
        </div>
      </main>
    );
  }

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
              window.location.href = `/inventory/${productId}`;
            }}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Back to Product
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-500">
            Inventory Adjustment
          </p>

          <h2 className="mt-1 text-3xl font-bold text-slate-900">
            Adjust {product.name}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Use this when the physical stock count differs from the system
            quantity. Every adjustment is recorded in the stock movement
            history.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Current Product Stock
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {Number(product.current_stock || 0)}
              {product.unit ? ` ${product.unit}` : ""}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Product Code
            </p>
            <p className="mt-2 text-xl font-bold text-slate-900">
              {product.product_code || "—"}
            </p>
          </div>
        </section>

        <form
          onSubmit={handleAdjust}
          className="rounded-2xl bg-white p-6 shadow-sm"
        >
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Select Batch
              </label>

              <select
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
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
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
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">
                  Current batch quantity
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {Number(selectedBatch.quantity_remaining || 0)}
                </p>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                New Physical Quantity
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={newQuantity}
                onChange={(event) => setNewQuantity(event.target.value)}
                placeholder="Enter the actual quantity counted"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />

              <p className="mt-2 text-xs text-slate-500">
                Enter the quantity you physically counted for this batch.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Reason
              </label>

              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                placeholder="Example: Physical stock count found 122 units."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <strong>Important:</strong> This changes both the selected
              batch quantity and the overall product stock. The adjustment
              will also be recorded in Stock Movement History.
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/inventory/${productId}`;
                }}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving Adjustment..." : "Save Adjustment"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
