"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export const PRACTICE_PAGE_SIZE = 25;

/** Search is performed by Postgres before pagination; no patient list is cached locally. */
export function usePracticeList<T>(rpc: string, search: string, page: number, filters: Record<string, unknown> = {}) {
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ rows: T[]; total: number; summary: Record<string, number>; error: string; key: string }>({ rows: [], total: 0, summary: {}, error: "", key: "" });
  const filterKey = JSON.stringify(filters);
  const requestKey = JSON.stringify([rpc, debouncedSearch, page, filterKey, version]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const { data, error } = await supabase.rpc(rpc, {
          p_search: debouncedSearch.trim(), p_page: page, p_page_size: PRACTICE_PAGE_SIZE,
          ...JSON.parse(filterKey),
        }).abortSignal(controller.signal);
        if (!active) return;
        if (error) throw error;
        setResult({ rows: data?.rows || [], total: Number(data?.total || 0), summary: data?.summary || {}, error: "", key: requestKey });
      } catch (error) {
        if (active) setResult({ rows: [], total: 0, summary: {}, key: requestKey,
          error: error && typeof error === "object" && "message" in error ? String(error.message) : "Could not load records. Please retry." });
      }
    };
    void load();
    return () => { active = false; controller.abort(); };
  }, [rpc, debouncedSearch, page, filterKey, version, requestKey]);

  return { ...result, loading: search !== debouncedSearch || result.key !== requestKey, refresh: () => setVersion(v => v + 1) };
}
