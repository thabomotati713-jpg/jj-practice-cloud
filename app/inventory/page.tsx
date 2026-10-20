"use client";

import { useEffect, useState } from "react";
import { usePracticeList } from "../../lib/usePracticeList";
import ListPagination from "../../components/ListPagination";
import { supabase } from "../../lib/supabase";
import { fetchMySpecialty, getSpecialty, SPECIALTIES, type SpecialtyConfig } from "../../lib/specialties";

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
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState<SpecialtyConfig>(
    getSpecialty("general")
  );
  const [specialtyReady, setSpecialtyReady] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState("");

  const [page, setPage] = useState(0);
  const { rows: products, total, summary, loading, error, refresh } = usePracticeList<Product>("pc_inventory_page", search, page, { p_categories: specialty.inventoryCategories });
  useEffect(() => {
    let active = true;
    fetchMySpecialty(supabase, supabase).then(config => { if (active) setSpecialty(config); })
      .finally(() => { if (active) setSpecialtyReady(true); });
    return () => { active = false; };
  }, []);

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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({specialty: specialty.id}),
      });

      const result = await response.json();

      if (!response.ok) {
        setSeedMessage(result.error || "Could not load the starter catalog.");
        setSeeding(false);
        return;
      }

      setSeedMessage(result.message || "Starter catalog loaded.");

      if (result.added > 0) {
        setPage(0);
        refresh();
      }
    } catch (seedError) {
      console.error(seedError);
      setSeedMessage("Something went wrong while loading the starter catalog.");
    }

    setSeeding(false);
  };

  const filteredProducts = products;
  const totalProducts = summary.count || 0;
  const lowStockProducts = summary.low || 0;
  const outOfStockProducts = summary.out || 0;
  const activeProducts = summary.active || 0;

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
            <label className="field" style={{margin:0}}>
              <span className="label">Starter catalogue speciality</span>
              <select className="input" value={specialty.id} disabled={seeding || !specialtyReady}
                onChange={event => {setSpecialty(getSpecialty(event.target.value));setSeedMessage("");setPage(0);}}>
                {SPECIALTIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
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
            <label className="field" style={{margin:0}}>
              <span className="label">Starter catalogue speciality</span>
              <select className="input" value={specialty.id} disabled={seeding || !specialtyReady}
                onChange={event => {setSpecialty(getSpecialty(event.target.value));setSeedMessage("");setPage(0);}}>
                {SPECIALTIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <button
              type="button"
              onClick={loadStarterCatalog}
              disabled={seeding || !specialtyReady}
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

        <p className="page-subtitle" style={{marginBottom:20}}>
          Choose a speciality and load its ready-made product list. Existing items are kept.
          New items start with zero stock and prices; receive stock and set your supplier prices before use.
          Mixed practices can load more than one catalogue.
        </p>
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
              maxLength={200}
              aria-label="Search all stock"
              onChange={(event) => { setSearch(event.target.value); setPage(0); }}
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
        <ListPagination page={page} total={total} loading={loading} onChange={setPage} />
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
