"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Product = {
  id: string;
  product_code: string | null;
  barcode: string | null;
  name: string;
  generic_name: string | null;
  category: string | null;
  strength: string | null;
  dosage_form: string | null;
  manufacturer: string | null;
  unit: string | null;
  purchase_price: number | null;
  selling_price: number | null;
  current_stock: number | null;
  minimum_stock: number | null;
  prescription_required: boolean | null;
  active: boolean | null;
};

type Batch = {
  id: string;
  batch_number: string | null;
  expiry_date: string | null;
  quantity_received: number | null;
  quantity_remaining: number | null;
  purchase_price: number | null;
  received_date: string | null;
  supplier: string | null;
};

type Movement = {
  id: string;
  movement_type: string | null;
  quantity: number | null;
  reference_type: string | null;
  reason: string | null;
  created_at: string;
};

export default function InventoryProductPage() {
  const params = useParams();
  const productId = String(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
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

    const { data: productData, error: productError } = await supabase
      .from("inventory_products")
      .select("*")
      .eq("id", productId)
      .eq("practice_id", practiceId)
      .single();

    if (productError || !productData) {
      setError(productError?.message || "Product could not be found.");
      setLoading(false);
      return;
    }

    const [batchesResult, movementsResult] = await Promise.all([
      supabase
        .from("inventory_batches")
        .select("*")
        .eq("product_id", productId)
        .eq("practice_id", practiceId)
        .order("expiry_date", { ascending: true }),

      supabase
        .from("stock_movements")
        .select("*")
        .eq("product_id", productId)
        .eq("practice_id", practiceId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (batchesResult.error) {
      setError(batchesResult.error.message);
    }

    if (movementsResult.error && !batchesResult.error) {
      setError(movementsResult.error.message);
    }

    setProduct(productData);
    setBatches(batchesResult.data || []);
    setMovements(movementsResult.data || []);
    setLoading(false);
  };

  const formatMoney = (value: number | null) => {
    return `R ${Number(value || 0).toFixed(2)}`;
  };

  const formatDate = (value: string | null) => {
    if (!value) return "—";

    return new Date(value).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const stock = Number(product?.current_stock || 0);
  const minimum = Number(product?.minimum_stock || 0);

  const stockStatus =
    stock <= 0
      ? {
          label: "Out of stock",
          className: "bg-red-100 text-red-700",
        }
      : stock <= minimum
        ? {
            label: "Low stock",
            className: "bg-amber-100 text-amber-700",
          }
        : {
            label: "In stock",
            className: "bg-green-100 text-green-700",
          };

  const getBatchStatus = (expiryDate: string | null) => {
    if (!expiryDate) {
      return {
        label: "No expiry date",
        className: "bg-slate-100 text-slate-600",
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(`${expiryDate}T00:00:00`);

    if (expiry < today) {
      return {
        label: "Expired",
        className: "bg-red-100 text-red-700",
      };
    }

    const daysUntilExpiry = Math.ceil(
      (expiry.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 30) {
      return {
        label: "Expires Soon",
        className: "bg-amber-100 text-amber-700",
      };
    }

    return {
      label: "Valid",
      className: "bg-green-100 text-green-700",
    };
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-slate-500">Loading product...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-slate-100">
        <div className="mx-auto max-w-7xl px-6 py-12">
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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
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

      <div className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Inventory Product
            </p>

            <h2 className="mt-1 text-3xl font-bold text-slate-900">
              {product.name}
            </h2>

            {product.generic_name && (
              <p className="mt-1 text-slate-500">
                {product.generic_name}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/inventory";
              }}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Inventory
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/inventory/${productId}/dispense`;
                }}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Dispense Stock
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = `/inventory/${productId}/receive`;
                }}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white"
              >
                + Receive Stock
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = `/inventory/${productId}/adjust`;
                }}
                className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Adjust Stock
              </button>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Current Stock"
            value={`${stock}${product.unit ? ` ${product.unit}` : ""}`}
          />

          <SummaryCard
            title="Minimum Stock"
            value={`${minimum}${product.unit ? ` ${product.unit}` : ""}`}
          />

          <SummaryCard
            title="Selling Price"
            value={formatMoney(product.selling_price)}
          />

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Stock Status
            </p>

            <span
              className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${stockStatus.className}`}
            >
              {stockStatus.label}
            </span>
          </div>
        </div>

        <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-xl font-bold text-slate-900">
            Product Information
          </h3>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Product Code" value={product.product_code} />
            <Info label="Barcode" value={product.barcode} />
            <Info label="Category" value={product.category} />
            <Info label="Strength" value={product.strength} />
            <Info label="Dosage Form" value={product.dosage_form} />
            <Info label="Manufacturer" value={product.manufacturer} />
            <Info label="Unit" value={product.unit} />
            <Info
              label="Purchase Price"
              value={formatMoney(product.purchase_price)}
            />
            <Info
              label="Selling Price"
              value={formatMoney(product.selling_price)}
            />
            <Info
              label="Prescription Required"
              value={product.prescription_required ? "Yes" : "No"}
            />
            <Info
              label="Product Status"
              value={product.active ? "Active" : "Inactive"}
            />
          </div>
        </section>

        <section className="mb-8 rounded-2xl bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Stock Batches
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Track batches, expiry dates and remaining quantities.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {batches.length} batch{batches.length === 1 ? "" : "es"}
              </span>
            </div>
          </div>

          {batches.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-semibold text-slate-900">
                No stock batches recorded
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Use Receive Stock to add the first batch.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Batch Number
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Expiry Date
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Received
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Remaining
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Purchase Price
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Received Date
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Supplier
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {batches.map((batch) => {
                    const status = getBatchStatus(batch.expiry_date);

                    return (
                      <tr key={batch.id}>
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {batch.batch_number || "—"}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {formatDate(batch.expiry_date)}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {Number(batch.quantity_received || 0)}
                        </td>

                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {Number(batch.quantity_remaining || 0)}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          R{Number(batch.purchase_price || 0).toFixed(2)}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {batch.received_date
                            ? formatDate(batch.received_date)
                            : "—"}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {batch.supplier || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <h3 className="text-xl font-bold text-slate-900">
              Stock Movement History
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              The latest stock movements for this product.
            </p>
          </div>

          {movements.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-semibold text-slate-900">
                No stock movements recorded
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Stock movements will appear here when inventory is received,
                issued or adjusted.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Date
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Movement
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Quantity
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Reference
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Reason
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(movement.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {movement.movement_type || "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {Number(movement.quantity || 0)}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {movement.reference_type || "—"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {movement.reason || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
}
