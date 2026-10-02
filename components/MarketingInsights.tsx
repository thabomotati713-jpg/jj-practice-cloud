"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { sources } from "@/lib/marketing/config";
type Snapshot = {
  connector: string;
  rows: Record<string, unknown>[];
  date_from: string;
  date_to: string;
  fetched_at: string;
  error: string | null;
};
export default function MarketingInsights() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function api(method = "GET") {
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/marketing/insights", {
      method,
      headers: { Authorization: `Bearer ${data.session?.access_token || ""}` },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Analytics unavailable.");
    return result;
  }
  async function load() {
    try {
      const data = await api();
      setSnapshots(data.snapshots);
      setReady(data.configured);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    let active = true;
    api()
      .then((data) => {
        if (active) {
          setSnapshots(data.snapshots);
          setReady(data.configured);
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function sync() {
    setBusy(true);
    setMessage("");
    try {
      const data = await api("POST");
      await load();
      setMessage(
        data.results.every((r: { ok: boolean }) => r.ok)
          ? "Analytics refreshed and Facebook leads imported."
          : "Some sources could not refresh. Last successful data is retained.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const metrics: Record<string, [string, string][]> = {
    facebook_organic: [["page_views_total", "Page views"]],
    googleanalytics4: [
      ["sessions", "Sessions"],
      ["screen_page_views", "Page views"],
    ],
    google_my_business: [
      ["impressions", "Impressions"],
      ["website_clicks", "Website clicks"],
    ],
    facebook_leads: [["lead_count", "Leads returned"]],
  };
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-teal-200">
            Connected intelligence
          </p>
          <h2 className="mt-2 text-2xl font-bold">Real marketing analytics</h2>
        </div>
        <button
          disabled={busy || !ready}
          onClick={() => void sync()}
          className="rounded-xl bg-teal-200 px-4 py-2 font-bold text-slate-950 disabled:opacity-40"
        >
          {busy ? "Syncing…" : "Sync analytics & leads"}
        </button>
      </div>
      <p className="mt-3 text-sm text-slate-300">
        Paid advertising: disabled in this application. LinkedIn: pending
        Company Page and verification.
      </p>
      {!ready && (
        <p className="mt-3 rounded-xl bg-amber-200/10 p-3 text-sm text-amber-100">
          Saved Windsor snapshots are available. Live refresh and publishing
          need WINDSOR_API_KEY in the Vercel server environment. No subscription
          is purchased automatically.
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(sources).map(([key, source]) => {
          const snap = snapshots.find((s) => s.connector === key);
          return (
            <article
              key={key}
              className="rounded-2xl border border-white/10 p-4"
            >
              <h3 className="font-bold">{source.label}</h3>
              <p className="mt-1 text-xs text-slate-400">
                {snap
                  ? `${snap.date_from} – ${snap.date_to}`
                  : "Awaiting first sync"}
              </p>
              {snap?.error && (
                <p className="mt-2 text-xs text-amber-200">{snap.error}</p>
              )}
              {!snap || !snap.rows.length ? (
                <p className="mt-4 text-sm text-slate-400">
                  No rows returned — not a confirmed zero.
                </p>
              ) : key === "facebook" ? (
                <div className="mt-3 space-y-2">
                  {snap.rows.map((r, i) => (
                    <p key={i} className="text-sm">
                      {String(r.campaign || "Campaign")} ·{" "}
                      {String(r.campaign_status || "Unknown")} ·{" "}
                      {String(r.currency || "")}{" "}
                      {Number(r.spend || 0).toFixed(2)}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-6">
                  {(metrics[key] || []).map(([field, label]) => {
                    const vals = snap.rows
                      .map((r) => r[field])
                      .filter(
                        (v) =>
                          v !== null &&
                          v !== undefined &&
                          Number.isFinite(Number(v)),
                      );
                    return (
                      <div key={field}>
                        <strong className="text-2xl">
                          {vals.length
                            ? vals
                                .reduce<number>((n, v) => n + Number(v), 0)
                                .toLocaleString("en-ZA")
                            : "Unavailable"}
                        </strong>
                        <p className="text-xs text-slate-400">{label}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              {snap && (
                <p className="mt-4 text-xs text-slate-500">
                  Fetched{" "}
                  {new Date(snap.fetched_at).toLocaleString("en-ZA", {
                    timeZone: "Africa/Johannesburg",
                  })}{" "}
                  SAST
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
