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
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Dispense Stock
            </h1>
            <p className="text-sm text-gray-600">
              Stock is automatically issued using first-expiry-first-out.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Dashboard
            </button>

            <button
              onClick={() => router.push(`/inventory/${productId}`)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Back to Product
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}

        {product && (
          <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              {product.name}
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              {product.generic_name || ""}
              {product.strength ? ` • ${product.strength}` : ""}
              {product.dosage_form ? ` • ${product.dosage_form}` : ""}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">Current Stock</p>
                <p className="text-3xl font-bold text-gray-900">
                  {Number(product.current_stock).toFixed(2)}
                  {product.unit ? ` ${product.unit}` : ""}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Available Non-Expired Batch Stock
                </p>
                <p className="text-3xl font-bold text-gray-900">
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
          </div>
        )}

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Quantity to Dispense
              </label>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                disabled={saving}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 disabled:bg-gray-100"
                placeholder="Enter quantity"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Reason / Notes
              </label>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                disabled={saving}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 disabled:bg-gray-100"
                placeholder="Optional"
              />
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-800">
                Available Batches — FEFO Order
              </h3>

              {batches.length === 0 ? (
                <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                  No non-expired batches with available stock.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-3">Batch</th>
                        <th className="px-3 py-3">Expiry</th>
                        <th className="px-3 py-3">Available</th>
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
                          <tr key={batch.id} className="border-b">
                            <td className="px-3 py-3 font-medium">
                              {batch.batch_number}
                            </td>

                            <td className="px-3 py-3">
                              {batch.expiry_date}
                              {daysUntilExpiry <= 30 && (
                                <span className="ml-2 text-xs font-medium text-orange-600">
                                  Expires soon
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-3">
                              {Number(batch.quantity_remaining).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || batches.length === 0}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Dispensing..." : "Dispense Stock"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
