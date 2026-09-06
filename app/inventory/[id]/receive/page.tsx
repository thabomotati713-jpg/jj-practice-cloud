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
              Receive Stock
            </h1>
            <p className="text-sm text-gray-600">
              Add stock to the selected product and create a stock movement.
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

            <div className="mt-4">
              <p className="text-sm text-gray-500">Current Stock</p>
              <p className="text-3xl font-bold text-gray-900">
                {Number(product.current_stock || 0).toFixed(2)}
                {product.unit ? ` ${product.unit}` : ""}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field
              label="Batch Number"
              value={batchNumber}
              onChange={setBatchNumber}
              placeholder="e.g. PND-002"
            />

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Expiry Date
                </label>

                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
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

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Received Date
                </label>

                <input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <Field
              label="Supplier"
              value={supplier}
              onChange={setSupplier}
              placeholder="Optional supplier name"
            />

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Reason / Notes
              </label>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                placeholder="Stock received"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push(`/inventory/${productId}`)}
                disabled={saving}
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Receiving Stock..." : "Receive Stock"}
              </button>
            </div>
          </form>
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
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
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
