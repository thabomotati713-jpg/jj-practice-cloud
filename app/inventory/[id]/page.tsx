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
      window.location.href = "/login";
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
          className: "badge badge-red",
        }
      : stock <= minimum
        ? {
            label: "Low stock",
            className: "badge badge-amber",
          }
        : {
            label: "In stock",
            className: "badge badge-green",
          };

  const getBatchStatus = (expiryDate: string | null) => {
    if (!expiryDate) {
      return {
        label: "No expiry date",
        className: "badge badge-gray",
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(`${expiryDate}T00:00:00`);

    if (expiry < today) {
      return {
        label: "Expired",
        className: "badge badge-red",
      };
    }

    const daysUntilExpiry = Math.ceil(
      (expiry.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 30) {
      return {
        label: "Expires Soon",
        className: "badge badge-amber",
      };
    }

    return {
      label: "Valid",
      className: "badge badge-green",
    };
  };

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-inner">
          <div className="card">
            <div className="empty-state">
              Loading product...
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="page-shell">
        <div className="page-inner">
          <div className="card">
            <div className="empty-state">
              <p className="font-semibold text-red-700">
                {error || "Product could not be found."}
              </p>

              <button
                type="button"
                onClick={() => {
                  window.location.href = "/inventory";
                }}
                className="btn btn-secondary btn-sm mt-5"
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
        {error && (
          <div className="alert-error">{error}</div>
        )}

        <div className="page-header">
          <div>
            <p className="page-subtitle">
              Inventory Product
            </p>

            <h1 className="page-title">
              {product.name}
            </h1>

            {product.generic_name && (
              <p className="page-subtitle">
                {product.generic_name}
              </p>
            )}
          </div>

          <div className="page-actions">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/inventory";
              }}
              className="btn btn-secondary btn-sm"
            >
              Inventory
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = `/inventory/${productId}/dispense`;
              }}
              className="btn btn-primary"
            >
              Dispense Stock
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = `/inventory/${productId}/receive`;
              }}
              className="btn btn-primary"
            >
              + Receive Stock
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = `/inventory/${productId}/adjust`;
              }}
              className="btn btn-secondary"
            >
              Adjust Stock
            </button>
          </div>
        </div>

        <div className="stat-grid">
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

          <div className="stat-card">
            <p className="stat-label">Stock Status</p>

            <span
              className={`badge mt-2 inline-flex ${stockStatus.className}`}
            >
              {stockStatus.label}
            </span>
          </div>
        </div>

        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Product Information</h3>
          </div>

          <div className="card-body">
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
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Stock Batches</h3>
              <p className="page-subtitle">
                Track batches, expiry dates and remaining quantities.
              </p>
            </div>

            <span className="badge badge-gray">
              {batches.length} batch{batches.length === 1 ? "" : "es"}
            </span>
          </div>

          {batches.length === 0 ? (
            <div className="empty-state">
              <p className="font-semibold text-slate-900">
                No stock batches recorded
              </p>

              <p className="mt-2">
                Use Receive Stock to add the first batch.
              </p>
            </div>
          ) : (
            <div className="table-wrap rounded-none border-0 shadow-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Batch Number</th>
                    <th>Expiry Date</th>
                    <th>Received</th>
                    <th>Remaining</th>
                    <th>Purchase Price</th>
                    <th>Received Date</th>
                    <th>Supplier</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {batches.map((batch) => {
                    const status = getBatchStatus(batch.expiry_date);

                    return (
                      <tr key={batch.id}>
                        <td className="font-semibold text-slate-900">
                          {batch.batch_number || "—"}
                        </td>

                        <td className="text-slate-600">
                          {formatDate(batch.expiry_date)}
                        </td>

                        <td className="text-slate-600">
                          {Number(batch.quantity_received || 0)}
                        </td>

                        <td className="font-semibold text-slate-900">
                          {Number(batch.quantity_remaining || 0)}
                        </td>

                        <td className="text-slate-600">
                          {formatMoney(batch.purchase_price)}
                        </td>

                        <td className="text-slate-600">
                          {batch.received_date
                            ? formatDate(batch.received_date)
                            : "—"}
                        </td>

                        <td className="text-slate-600">
                          {batch.supplier || "—"}
                        </td>

                        <td>
                          <span className={status.className}>
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

        <section className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Stock Movement History</h3>
              <p className="page-subtitle">
                The latest stock movements for this product.
              </p>
            </div>
          </div>

          {movements.length === 0 ? (
            <div className="empty-state">
              <p className="font-semibold text-slate-900">
                No stock movements recorded
              </p>

              <p className="mt-2">
                Stock movements will appear here when inventory is received,
                issued or adjusted.
              </p>
            </div>
          ) : (
            <div className="table-wrap rounded-none border-0 shadow-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Movement</th>
                    <th>Quantity</th>
                    <th>Reference</th>
                    <th>Reason</th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="text-slate-600">
                        {formatDate(movement.created_at)}
                      </td>

                      <td>
                        <span className="badge badge-gray">
                          {movement.movement_type || "—"}
                        </span>
                      </td>

                      <td className="font-semibold text-slate-900">
                        {Number(movement.quantity || 0)}
                      </td>

                      <td className="text-slate-600">
                        {movement.reference_type || "—"}
                      </td>

                      <td className="text-slate-600">
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
    <div className="stat-card">
      <p className="stat-label">{title}</p>

      <p className="stat-value">{value}</p>
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
      <p className="stat-label">{label}</p>

      <p className="mt-1 text-sm font-medium text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
}
