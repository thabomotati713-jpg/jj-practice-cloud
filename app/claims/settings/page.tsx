"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { claimRequest } from "@/lib/claims/client";
import { emptyClaimConfig, type ClaimConfig } from "@/lib/claims/model";
type Provider = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  active: boolean;
};
type Route = {
  id: string;
  name: string;
  email: string;
  source: string;
  checked: string;
};
export default function ClaimSettings() {
  const [config, setConfig] = useState<ClaimConfig>(emptyClaimConfig),
    [providers, setProviders] = useState<Provider[]>([]),
    [routes, setRoutes] = useState<Route[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [confirmed, setConfirmed] = useState(false),
    [canEdit, setCanEdit] = useState(false),
    [ready, setReady] = useState(false),
    [email, setEmail] = useState(false),
    [webhook, setWebhook] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void claimRequest<{
      config: ClaimConfig;
      providers: Provider[];
      routes: Route[];
      canEdit: boolean;
      emailConfigured: boolean;
      deliveryWebhookConfigured: boolean;
    }>("/api/claims/settings")
      .then((r) => {
        if (!active) return;
        setConfig(r.config);
        setProviders(r.providers);
        setRoutes(r.routes);
        setSelected(Object.keys(r.config.routes));
        setCanEdit(r.canEdit);
        setEmail(r.emailConfigured);
        setWebhook(r.deliveryWebhookConfigured);
        setReady(true);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await claimRequest<{ config: ClaimConfig }>(
        "/api/claims/settings",
        {
          auto_prepare: config.auto_prepare,
          submission_enabled: config.submission_enabled,
          providers: Object.entries(config.providers)
            .filter(([, d]) => d.pcns || d.registration)
            .map(([id, d]) => ({ id, ...d })),
          routes: selected,
          route_confirmation: confirmed,
        },
        undefined,
        "PUT",
      );
      setConfig(result.config);
      setConfirmed(false);
      setMessage(
        "Claim automation settings saved. No existing claim was sent.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/dashboard" className="app-brand">
            <span className="app-brand-name">J&J PracticeCloud</span>
          </Link>
          <div className="page-actions">
            <Link href="/claims" className="btn btn-secondary btn-sm">
              Claims
            </Link>
            <Link href="/settings" className="btn btn-secondary btn-sm">
              Practice settings
            </Link>
          </div>
        </div>
      </header>
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Claim automation settings</h1>
            <p className="page-subtitle">
              Set up the treating practitioners and confirm the medical scheme
              inboxes once for your practice.
            </p>
          </div>
        </div>
        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="alert-success" role="status">
            {message}
          </div>
        )}
        <section className="card">
          <div className="card-body">
            <p>
              <strong>Email service:</strong>{" "}
              {email
                ? "Configured sender"
                : "Verified sender configuration required"}
            </p>
            <p className="page-subtitle">
              {webhook
                ? "Signed delivery receipts configured."
                : "Delivery status can refresh through the email provider when the key permits it. A signed webhook can also receive receipts. Scheme approval is recorded separately."}
            </p>
          </div>
        </section>
        <fieldset
          disabled={!ready || !canEdit || busy}
          className="space-y-5 mt-5"
        >
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Automation controls</h2>
            </div>
            <div className="card-body space-y-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={config.auto_prepare}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, auto_prepare: e.target.checked }))
                  }
                />
                <span>
                  Automatically prepare draft claims for new unpaid medical-aid
                  invoices. Claims still need review before submission.
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={config.submission_enabled}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      submission_enabled: e.target.checked,
                    }))
                  }
                />
                <span>
                  Enable email submission of claims approved by the practice.
                  Switch off to pause queued submissions.
                </span>
              </label>
              <p className="page-subtitle">
                Preparation runs after normal invoice creation, with a daily
                catch-up at 08:30 South African time. Enabling preparation
                starts with new invoices from this point forward.
              </p>
            </div>
          </section>
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Practitioner credentials</h2>
            </div>
            <div className="card-body space-y-5">
              {providers.map((p) => (
                <div key={p.id}>
                  <h3 className="label">
                    {[p.first_name, p.last_name].filter(Boolean).join(" ") ||
                      p.display_name}{" "}
                    {!p.active && "(inactive profile)"}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="field">
                      <span className="label">
                        PCNS practice number · 7 digits
                      </span>
                      <input
                        className="input"
                        inputMode="numeric"
                        maxLength={7}
                        value={config.providers[p.id]?.pcns || ""}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            providers: {
                              ...c.providers,
                              [p.id]: {
                                registration:
                                  c.providers[p.id]?.registration || "",
                                pcns: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="label">Professional registration</span>
                      <input
                        className="input"
                        maxLength={40}
                        value={config.providers[p.id]?.registration || ""}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            providers: {
                              ...c.providers,
                              [p.id]: {
                                pcns: c.providers[p.id]?.pcns || "",
                                registration: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
              <p className="page-subtitle">
                Use the registered details of the treating practitioner. An
                internal practice code is not a PCNS number. Leave both fields
                blank for practitioners you are not configuring yet.
              </p>
            </div>
          </section>
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Medical scheme destinations</h2>
            </div>
            <div className="card-body space-y-5">
              {routes.map((r) => (
                <div key={r.id}>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={(e) => {
                        setSelected((c) =>
                          e.target.checked
                            ? [...c, r.id]
                            : c.filter((id) => id !== r.id),
                        );
                        setConfirmed(false);
                      }}
                    />
                    <span>
                      <strong>{r.name}</strong>
                      <br />
                      {r.email}
                    </span>
                  </label>
                  <a
                    className="text-sm underline ml-7"
                    href={r.source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Official claims information · checked {r.checked}
                  </a>
                </div>
              ))}
              <p className="page-subtitle">
                These are published claims inboxes. Confirm that the scheme
                accepts email claims from your practice for these services.
                Schemes administered by another company are matched by their own
                name, never by administrator alone. Other schemes can use the
                prepared PDF through their approved portal or switch.
              </p>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I verified the selected inboxes accept this practice’s claims
                  and confirmed practice approval and patient authority to send
                  patient identifiers, membership details, diagnostic codes and
                  charges to those schemes.
                </span>
              </label>
            </div>
          </section>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save claim settings"}
          </button>
        </fieldset>
        {ready && !canEdit && (
          <p className="alert-info mt-5">
            The practice owner or administrator can change these settings.
          </p>
        )}
      </div>
    </main>
  );
}
