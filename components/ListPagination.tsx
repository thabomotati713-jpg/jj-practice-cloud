"use client";

import { PRACTICE_PAGE_SIZE } from "../lib/usePracticeList";

export default function ListPagination({ page, total, loading, onChange }: {
  page: number; total: number; loading: boolean; onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PRACTICE_PAGE_SIZE));
  return (
    <nav aria-label="Results pages" className="flex flex-wrap items-center justify-between gap-3 py-4">
      <p className="text-sm text-slate-600" role="status" aria-live="polite">
        {loading ? "Searching practice records…" : total === 0 ? "No matching records" :
          `${page * PRACTICE_PAGE_SIZE + 1}–${Math.min((page + 1) * PRACTICE_PAGE_SIZE, total)} of ${total.toLocaleString()} records`}
      </p>
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-secondary btn-sm" disabled={loading || page === 0} onClick={() => onChange(page - 1)}>Previous</button>
        <span className="text-sm">Page {page + 1} of {pages}</span>
        <button type="button" className="btn btn-secondary btn-sm" disabled={loading || page + 1 >= pages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </nav>
  );
}
