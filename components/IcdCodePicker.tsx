"use client";
import { useEffect, useId, useState } from "react";
import type { IcdCode } from "@/lib/icd10";
import styles from "./clinical-library.module.css";

export default function IcdCodePicker({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (code: string) => void;
  onSelect?: (row: IcdCode) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<IcdCode[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      setError("");
      setActive(-1);
      try {
        const res = await fetch(
          `/api/icd10?q=${encodeURIComponent(query)}&terminal=true&limit=12`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!controller.signal.aborted) setRows(data.rows);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError"))
          setError("Lookup unavailable. You can still enter a code manually.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);
  function choose(row: IcdCode) {
    onChange(row.code);
    onSelect?.(row);
    setQuery("");
    setOpen(false);
  }
  return (
    <div
      className={styles.picker}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setOpen(false);
      }}
    >
      <label className="field">
        <span className="label">ICD-10 code</span>
        <input
          className="input"
          value={value}
          maxLength={40}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter a code, or search below"
        />
      </label>
      <label className="field">
        <span className="label">Find a diagnosis code</span>
        <input
          className="input"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-results`}
          aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setRows([]);
            setActive(-1);
            setBusy(true);
            setOpen(true);
          }}
          placeholder="Search code or diagnosis, e.g. I10 or hypertension"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((i) =>
                Math.max(
                  0,
                  Math.min(
                    rows.length - 1,
                    i + (e.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
            }
            if (e.key === "Enter" && open) {
              e.preventDefault();
              if (active >= 0 && rows[active]) choose(rows[active]);
            }
          }}
        />
      </label>
      {open && (
        <div className={styles.results}>
          <p className={styles.resultStatus} role="status">
            {busy
              ? "Searching…"
              : error ||
                (!rows.length
                  ? "No matching codes. Try a different term."
                  : "Choose a code · diagnosis notes are preserved")}
          </p>
          <div
            id={`${id}-results`}
            role="listbox"
            aria-label="Matching ICD-10 codes"
          >
            {!busy &&
              !error &&
              rows.map((row, i) => (
                <button
                  id={`${id}-${i}`}
                  key={row.code}
                  role="option"
                  aria-selected={i === active}
                  type="button"
                  className={styles.result}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(row)}
                >
                  <strong>{row.code}</strong>
                  <span>{row.title}</span>
                </button>
              ))}
          </div>
        </div>
      )}
      <p className={styles.source}>
        WHO ICD-10 2019 + COVID updates. Confirm coding notes and the South
        African MIT before billing.{" "}
        <a
          href="https://icd.who.int/browse10/2019/en"
          target="_blank"
          rel="noreferrer"
        >
          WHO reference ↗
        </a>
      </p>
    </div>
  );
}
