"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AuditEvent = {
  id: string;
  user_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
};

const ACTION_BADGES: Record<string, string> = {
  view: "badge badge-gray",
  create: "badge badge-green",
  update: "badge badge-amber",
  delete: "badge badge-red",
  print: "badge badge-blue",
};

export default function AuditTrailPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTrail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTrail = async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Your session has expired. Please sign in again.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/audit", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Could not load the audit trail.");
        setLoading(false);
        return;
      }

      setEvents((result.events || []) as AuditEvent[]);
    } catch (loadError) {
      console.error(loadError);
      setError("Something went wrong while loading the audit trail.");
    }

    setLoading(false);
  };

  const viewHref = (event: AuditEvent): string | null => {
    if (!event.entity_id) {
      // List-level events have no single record to open.
      if (event.entity === "sick_note") return "/sick-notes";
      if (event.entity === "prescription") return "/prescriptions";
      if (event.entity === "claim") return "/claims";
      return null;
    }

    switch (event.entity) {
      case "patient":
        return `/patients/${event.entity_id}`;
      case "invoice":
        return `/invoices/${event.entity_id}`;
      case "claim":
        return `/claims/${event.entity_id}`;
      case "sick_note":
        return "/sick-notes";
      case "prescription":
        return "/prescriptions";
      default:
        return null;
    }
  };

  const formatWhen = (iso: string) => {
    const date = new Date(iso);

    return date.toLocaleString("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="page-shell">
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
            <a href="/settings" className="btn btn-secondary btn-sm">
              ← Settings
            </a>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Audit Trail</h1>
            <p className="page-subtitle">
              Every access to sensitive patient records — POPIA access log.
              Entries are permanent and cannot be edited or deleted from the
              app.
            </p>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {loading ? (
          <p className="text-slate-500">Loading audit trail…</p>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <h3>No audit events yet</h3>
            <p>
              Access to patient records, sick notes, prescriptions, invoices
              and claims will appear here as staff use the system.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>Detail</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatWhen(event.created_at)}
                    </td>
                    <td>{event.user_email || "—"}</td>
                    <td>
                      <span
                        className={
                          ACTION_BADGES[event.action] || "badge badge-gray"
                        }
                      >
                        {event.action}
                      </span>
                    </td>
                    <td className="capitalize">{event.entity}</td>
                    <td>
                      {event.details || "—"}
                      {event.entity_id && (
                        <span className="text-xs text-slate-400 block">
                          ref {event.entity_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td>
                      {viewHref(event) ? (
                        <a
                          href={viewHref(event) as string}
                          className="btn btn-secondary btn-sm"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
