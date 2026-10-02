"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
type Lead = {
  id: string;
  contact_name: string;
  notes?: string | null;
  follow_up_at?: string | null;
  demo_at?: string | null;
  demo_url?: string | null;
};
const local = (v?: string | null) =>
  v ? new Date(Date.parse(v) + 7200000).toISOString().slice(0, 16) : "";
export default function MarketingLeadEditor({
  lead,
  onSaved,
}: {
  lead: Lead;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [notes, setNotes] = useState(lead.notes || ""),
    [follow, setFollow] = useState(local(lead.follow_up_at)),
    [demo, setDemo] = useState(local(lead.demo_at)),
    [url, setUrl] = useState(lead.demo_url || ""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch("/api/marketing/crm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token || ""}`,
        },
        body: JSON.stringify({
          leadId: lead.id,
          notes,
          followUpAt: follow
            ? new Date(follow + ":00+02:00").toISOString()
            : null,
          demoAt: demo ? new Date(demo + ":00+02:00").toISOString() : null,
          demoUrl: url,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      await onSaved();
      setMessage("Saved. Contact the prospect to confirm their demo.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function calendar() {
    if (!lead.demo_at) return;
    const date = (n: number) =>
      new Date(n)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const escape = (s: string) =>
      s
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
    const body = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//JJ PracticeCloud//Marketing//EN",
      "BEGIN:VEVENT",
      `UID:${lead.id}@jj-practicecloud`,
      `DTSTAMP:${date(Date.now())}`,
      `DTSTART:${date(Date.parse(lead.demo_at))}`,
      `DTEND:${date(Date.parse(lead.demo_at) + 1800000)}`,
      `SUMMARY:${escape("PracticeCloud demo — " + lead.contact_name)}`,
      `URL:${escape(lead.demo_url || "")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    a.download = "practicecloud-demo.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs font-bold text-teal-200"
      >
        {open ? "Close details" : "Notes / follow-up / demo"}
      </button>
      {lead.demo_at && (
        <button onClick={calendar} className="ml-3 text-xs text-teal-200">
          Download calendar
        </button>
      )}
      {lead.follow_up_at && (
        <p className="mt-1 text-xs">
          Follow-up: {local(lead.follow_up_at).replace("T", " ")} SAST
        </p>
      )}
      {open && (
        <div className="mt-3 space-y-3 rounded-xl bg-slate-900 p-3">
          <label className="block text-xs">
            Notes
            <textarea
              className="mt-1 w-full rounded bg-slate-800 p-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label className="block text-xs">
            Follow-up (SAST)
            <input
              type="datetime-local"
              className="mt-1 block rounded bg-slate-800 p-2"
              value={follow}
              onChange={(e) => setFollow(e.target.value)}
            />
          </label>
          <label className="block text-xs">
            Demo · 30 minutes (SAST)
            <input
              type="datetime-local"
              step="1800"
              className="mt-1 block rounded bg-slate-800 p-2"
              value={demo}
              onChange={(e) => setDemo(e.target.value)}
            />
          </label>
          <label className="block text-xs">
            Meeting link
            <input
              type="url"
              className="mt-1 w-full rounded bg-slate-800 p-2"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <button
            disabled={busy}
            onClick={() => void save()}
            className="rounded bg-teal-200 px-3 py-2 text-xs font-bold text-slate-950"
          >
            Save details
          </button>
          {message && (
            <p role="status" className="text-xs">
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
