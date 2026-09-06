"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

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

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
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

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return products;
    }

    return products.filter((product) =>
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
    );
  }, [products, search]);

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
        className: "bg-red-100 text-red-700",
      };
    }

    if (stock <= minimum) {
      return {
        label: "Low stock",
        className: "bg-amber-100 text-amber-700",
      };
    }

    return {
      label: "In stock",
      className: "bg-green-100 text-green-700",
    };
  };

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
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Dashboard
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">
              Inventory
            </h2>
            <p className="mt-1 text-slate-500">
              Manage medicines, products and stock levels.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/inventory/new";
            }}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Add Product
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Search Inventory
          </label>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, generic name, product code, barcode..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-slate-500">
              Loading inventory...
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">
              No products found
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {products.length === 0
                ? "Your inventory is currently empty."
                : "Try changing your search."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Product
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Code
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Category
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Stock
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Selling Price
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Status
                    </th>
                    <th className="px-5 py-4 text-left font-semibold text-slate-600">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {filteredProducts.map((product) => {
                    const status = stockStatus(product);

                    return (
                      <tr key={product.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4">
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

                        <td className="px-5 py-4 text-slate-600">
                          {product.product_code || "—"}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {product.category || "—"}
                        </td>

                        <td className="px-5 py-4">
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

                        <td className="px-5 py-4 font-medium text-slate-700">
                          {formatMoney(product.selling_price)}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              window.location.href = `/inventory/${product.id}`;
                            }}
                            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
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
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}
