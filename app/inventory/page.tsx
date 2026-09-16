"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fetchMySpecialty, getSpecialty, type SpecialtyConfig } from "../../lib/specialties";

type Product = {
  id: string;
  practice_id: string;
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
  created_at: string;
  updated_at: string;
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [specialty, setSpecialty] = useState<SpecialtyConfig>(
    getSpecialty("general")
  );
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState("");

  useEffect(() => {
    loadProducts();
    fetchMySpecialty(supabase, supabase).then(setSpecialty);
  }, []);

  const loadProducts = async () => {
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

    const { data, error: productsError } = await supabase
      .from("inventory_products")
      .select("*")
      .eq("practice_id", profile.practice_id)
      .order("name", { ascending: true });

    if (productsError) {
      setError(productsError.message);
      setLoading(false);
      return;
    }

    setProducts(data || []);
    setLoading(false);
  };

  const loadStarterCatalog = async () => {
    setSeeding(true);
    setSeedMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setSeedMessage("Your session has expired. Please sign in again.");
        setSeeding(false);
        return;
      }

      const response = await fetch("/api/inventory/seed-starter", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setSeedMessage(result.error || "Could not load the starter catalog.");
        setSeeding(false);
        return;
      }

      setSeedMessage(result.message || "Starter catalog loaded.");

      if (result.added > 0) {
        await loadProducts();
      }
    } catch (seedError) {
      console.error(seedError);
      setSeedMessage("Something went wrong while loading the starter catalog.");
    }

    setSeeding(false);
  };

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    const matches = term
      ? products.filter((product) =>
          [
            product.name,
            product.generic_name,
            product.product_code,
            product.barcode,
            product.category,
            product.manufacturer,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))
        )
      : products;

    // Specialty-aware ordering: items in the logged-in provider's own
    // categories (a dentist's dental stock, an optometrist's frames)
    // always appear before everything else.
    const specialtyCategories = new Set(
      specialty.inventoryCategories.map((c) => c.toLowerCase())
    );

    return [...matches].sort((a, b) => {
      const aOwn = specialtyCategories.has(
        String(a.category || "").toLowerCase()
      )
        ? 0
        : 1;
      const bOwn = specialtyCategories.has(
        String(b.category || "").toLowerCase()
      )
        ? 0
        : 1;

      return aOwn - bOwn;
    });
  }, [products, search, specialty]);

  const totalProducts = products.length;

  const lowStockProducts = products.filter(
    (product) =>
      Number(product.current_stock || 0) <=
      Number(product.minimum_stock || 0)
  ).length;

  const outOfStockProducts = products.filter(
    (product) => Number(product.current_stock || 0) <= 0
  ).length;

  const activeProducts = products.filter(
    (product) => product.active !== false
  ).length;

  const formatMoney = (value: number | null) => {
    return `R ${Number(value || 0).toFixed(2)}`;
  };

  const stockStatus = (product: Product) => {
    const stock = Number(product.current_stock || 0);
    const minimum = Number(product.minimum_stock || 0);

    if (stock <= 0) {
      return {
        label: "Out of stock",
        className: "badge badge-red",
      };
    }

    if (stock <= minimum) {
      return {
        label: "Low stock",
        className: "badge badge-amber",
      };
    }

    return {
      label: "In stock",
      className: "badge badge-green",
    };
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
                window.location.href = "/dashboard";
              }}
              className="btn btn-secondary btn-sm"
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Inventory</h1>
            <p className="page-subtitle">
              Manage medicines, products and stock levels.
            </p>
          </div>

          <div className="page-actions">
            <button
              type="button"
              onClick={loadStarterCatalog}
              disabled={seeding}
              className="btn btn-secondary"
            >
              {seeding
                ? "Loading catalog..."
                : `Load ${specialty.label} starter items`}
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/inventory/new";
              }}
              className="btn btn-primary"
            >
              + Add Product
            </button>
          </div>
        </div>

        {seedMessage && (
          <div className="alert-info">{seedMessage}</div>
        )}

        {error && (
          <div className="alert-error">{error}</div>
        )}

        <div className="stat-grid">
          <SummaryCard
            title="Total Products"
            value={totalProducts}
          />

          <SummaryCard
            title="Active Products"
            value={activeProducts}
          />

          <SummaryCard
            title="Low Stock"
            value={lowStockProducts}
          />

          <SummaryCard
            title="Out of Stock"
            value={outOfStockProducts}
          />
        </div>

        <div className="card">
          <div className="card-body">
            <label className="label" htmlFor="inventory-search">
              Search Inventory
            </label>

            <input
              id="inventory-search"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, generic name, product code, barcode..."
              className="input"
            />
          </div>
        </div>

        {loading ? (
          <div className="card">
            <div className="empty-state">
              Loading inventory...
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <p className="font-semibold text-slate-900">
                No products found
              </p>

              <p className="mt-2">
                {products.length === 0
                  ? "Your inventory is currently empty."
                  : "Try changing your search."}
              </p>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Code</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Selling Price</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const status = stockStatus(product);

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="font-semibold text-slate-900">
                          {product.name}
                        </div>

                        {product.generic_name && (
                          <div className="mt-1 text-xs text-slate-500">
                            {product.generic_name}
                          </div>
                        )}

                        {(product.strength || product.dosage_form) && (
                          <div className="mt-1 text-xs text-slate-500">
                            {[product.strength, product.dosage_form]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        )}
                      </td>

                      <td className="text-slate-600">
                        {product.product_code || "—"}
                      </td>

                      <td className="text-slate-600">
                        {product.category || "—"}
                      </td>

                      <td>
                        <div className="font-semibold text-slate-900">
                          {Number(product.current_stock || 0)}
                          {product.unit
                            ? ` ${product.unit}`
                            : ""}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          Minimum:{" "}
                          {Number(product.minimum_stock || 0)}
                        </div>
                      </td>

                      <td className="font-medium text-slate-700">
                        {formatMoney(product.selling_price)}
                      </td>

                      <td>
                        <span className={status.className}>
                          {status.label}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = `/inventory/${product.id}`;
                          }}
                          className="btn btn-secondary btn-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="stat-card">
      <p className="stat-label">{title}</p>

      <p className="stat-value">{value}</p>
    </div>
  );
}
