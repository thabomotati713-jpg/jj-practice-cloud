"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { MEDICATION_CATALOG } from "@/lib/medication-catalog";
import type { IcdCode } from "@/lib/icd10";
import styles from "@/components/clinical-library.module.css";

type CodeResults = {
  rows: IcdCode[];
  total: number;
  chapters: { id: string; title: string }[];
  version: string;
};
export default function ClinicalLibrary() {
  const [tab, setTab] = useState("codes");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [page, setPage] = useState(0);
  const [results, setResults] = useState<CodeResults>({
    rows: [],
    total: 0,
    chapters: [],
    version: "",
  });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [canImport, setCanImport] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [terminal, setTerminal] = useState(true);
  useEffect(() => {
    let active = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("role,active")
        .eq("id", user.id)
        .single();
      if (active)
        setCanImport(
          !!data?.active && ["owner", "admin", "inventory"].includes(data.role),
        );
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (tab !== "codes") return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/icd10?q=${encodeURIComponent(query)}&chapter=${group}&page=${page}&limit=50&terminal=${terminal}`,
          { signal: controller.signal },
        );
        if (!response.ok)
          throw new Error("Could not load ICD-10 codes. Please retry.");
        const data = await response.json();
        if (!controller.signal.aborted) setResults(data);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Could not load codes.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tab, query, group, page, terminal]);
  const medicines = useMemo(
    () =>
      MEDICATION_CATALOG.filter(
        (item) =>
          (!group || item.group === group) &&
          `${item.name} ${item.group}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [query, group],
  );
  const visibleMedicines = medicines.slice(page * 50, (page + 1) * 50);
  const total = tab === "codes" ? results.total : medicines.length;
  function changeTab(value: string) {
    setTab(value);
    setLoading(value === "codes");
    setQuery("");
    setGroup("");
    setPage(0);
    setError("");
    setMessage("");
  }
  async function importSelected() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session)
        throw new Error(
          "Sign in as a practice administrator or inventory manager to import items.",
        );
      const response = await fetch("/api/inventory/seed-starter", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ medications: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed.");
      setMessage(data.message);
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="page-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/dashboard" className="app-brand">
            <Image
              src="/logo.jpg"
              alt=""
              width={44}
              height={44}
              unoptimized
              className="app-brand-logo"
            />
            <span className="app-brand-name">J&J Practice Cloud</span>
          </Link>
          <div className="page-actions">
            <Link href="/inventory" className="btn btn-secondary btn-sm">
              Inventory
            </Link>
            <Link href="/dashboard" className="btn btn-secondary btn-sm">
              Dashboard
            </Link>
          </div>
        </div>
      </header>
      <div className="page-inner">
        <section className={styles.hero}>
          <div className={styles.eyebrow}>YOUR CLINICAL WORKSPACE</div>
          <h1>A faster way to find the details.</h1>
          <p>
            Preloaded diagnosis codes and generic medication templates, ready to
            search. Fewer lookups. Less repetitive typing.
          </p>
        </section>
        <div className={styles.tabs} aria-label="Library section">
          <button
            type="button"
            aria-pressed={tab === "codes"}
            onClick={() => changeTab("codes")}
          >
            ICD-10 reference
          </button>
          <button
            type="button"
            aria-pressed={tab === "medicines"}
            onClick={() => changeTab("medicines")}
          >
            Medication catalogue · {MEDICATION_CATALOG.length}
          </button>
        </div>
        {message && (
          <p className="alert-success" role="status">
            {message} <Link href="/inventory">Open inventory →</Link>
          </p>
        )}
        {error && (
          <p className="alert-error" role="alert">
            {error}
          </p>
        )}
        <section className="card">
          <div className="card-body">
            <div className={styles.filters}>
              <label className="field">
                <span className="label">
                  {tab === "codes"
                    ? "Search code or diagnosis"
                    : "Search medicine, strength or group"}
                </span>
                <input
                  className="input"
                  type="search"
                  value={query}
                  maxLength={120}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  placeholder={
                    tab === "codes"
                      ? "Try I10, diabetes or asthma"
                      : "Try metformin, 500 mg or respiratory"
                  }
                />
              </label>
              <label className="field">
                <span className="label">
                  {tab === "codes" ? "Chapter" : "Medication group"}
                </span>
                <select
                  className="input"
                  value={group}
                  onChange={(e) => {
                    setGroup(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">
                    All {tab === "codes" ? "chapters" : "groups"}
                  </option>
                  {tab === "codes"
                    ? results.chapters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id} · {c.title}
                        </option>
                      ))
                    : [...new Set(MEDICATION_CATALOG.map((m) => m.group))].map(
                        (g) => <option key={g}>{g}</option>,
                      )}
                </select>
              </label>
            </div>
            {tab === "codes" ? (
              <>
                <label>
                  <input
                    type="checkbox"
                    className={styles.selection}
                    checked={terminal}
                    onChange={(e) => {
                      setTerminal(e.target.checked);
                      setPage(0);
                    }}
                  />{" "}
                  Show terminal codes suitable for primary-code lookup
                </label>
                <p className={styles.source}>
                  Source: © World Health Organization. ICD-10, Sixth Edition,
                  2019; COVID-19 expanded release. CC BY-ND 3.0 IGO. Titles
                  reproduced unchanged. This reference omits inclusion/exclusion
                  notes and does not validate a diagnosis or claim. Check the{" "}
                  <a
                    href="https://icd.who.int/browse10/2019/en"
                    target="_blank"
                    rel="noreferrer"
                  >
                    WHO coding reference
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://www.health.gov.za/icd-10-master-industry-table/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    South African MIT
                  </a>
                  . WHO does not endorse this product.
                </p>
              </>
            ) : (
              <>
                <div className={styles.note}>
                  Templates create product records with zero stock and zero
                  prices. Review the exact product, pack/unit and prescription
                  requirements before receiving or dispensing. Doses and
                  treatment instructions remain the clinician’s responsibility.
                </div>
                <div className={styles.toolbar}>
                  <div className="page-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={
                        !canImport || saving || !visibleMedicines.length
                      }
                      onClick={() =>
                        setSelected((current) => [
                          ...new Set([
                            ...current,
                            ...visibleMedicines.map((m) => m.name),
                          ]),
                        ])
                      }
                    >
                      Select this page
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!selected.length || saving}
                      onClick={() => setSelected([])}
                    >
                      Clear selection
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!canImport || saving || !selected.length}
                    onClick={() => void importSelected()}
                  >
                    {saving
                      ? "Importing…"
                      : `Add ${selected.length} selected to inventory`}
                  </button>
                </div>
                {!canImport && (
                  <p className={styles.source}>
                    Browse freely. Practice administrators and inventory
                    managers can import selected products.
                  </p>
                )}
              </>
            )}
            <div className={styles.toolbar}>
              <p role="status">
                {loading
                  ? "Searching…"
                  : `${total.toLocaleString()} matching ${tab === "codes" ? "codes" : "medicines"}`}
              </p>
              <p>
                Page {page + 1} of {Math.max(1, Math.ceil(total / 50))}
              </p>
            </div>
            <div className="table-wrap" aria-busy={loading}>
              <table className={`table ${styles.table}`}>
                <thead>
                  <tr>
                    {tab === "codes" ? (
                      <>
                        <th scope="col">Code</th>
                        <th scope="col">Description</th>
                        <th scope="col">Reference</th>
                      </>
                    ) : (
                      <>
                        <th scope="col">Select</th>
                        <th scope="col">Generic product</th>
                        <th scope="col">Group</th>
                        <th scope="col">Form</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tab === "codes"
                    ? results.rows.map((row) => (
                        <tr key={row.code}>
                          <td className={styles.mono}>{row.code}</td>
                          <td>
                            {row.title}
                            {!row.terminal && (
                              <small>
                                Category · choose a more specific code
                              </small>
                            )}
                            {row.secondary && (
                              <small>
                                Secondary code · requires an underlying
                                condition code
                              </small>
                            )}
                          </td>
                          <td>
                            <a
                              href={`https://icd.who.int/browse10/2019/en#/${encodeURIComponent(row.code)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary btn-sm"
                              aria-label={`Open WHO reference for ${row.code}`}
                            >
                              WHO ↗
                            </a>
                          </td>
                        </tr>
                      ))
                    : visibleMedicines.map((item) => (
                        <tr key={item.name}>
                          <td>
                            <input
                              type="checkbox"
                              className={styles.selection}
                              aria-label={`Select ${item.name}`}
                              disabled={!canImport || saving}
                              checked={selected.includes(item.name)}
                              onChange={(e) =>
                                setSelected((current) =>
                                  e.target.checked
                                    ? [...current, item.name]
                                    : current.filter(
                                        (name) => name !== item.name,
                                      ),
                                )
                              }
                            />
                          </td>
                          <td>
                            <strong>{item.generic_name}</strong>
                            <small>
                              {item.strength || "Confirm product specification"}
                            </small>
                          </td>
                          <td>{item.group}</td>
                          <td>{item.dosage_form}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
              {!loading && !total && (
                <p className="empty-state">No matches. Try another search.</p>
              )}
            </div>
            <div className={styles.toolbar}>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={(page + 1) * 50 >= total || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
