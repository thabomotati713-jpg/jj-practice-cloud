"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { claimRequest, ClaimRequestError } from "@/lib/claims/client";
import type { ClaimSnapshot, ClaimIssue } from "@/lib/claims/model";
import ClaimPacketPreview from "@/components/ClaimPacketPreview";
type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  balance: number;
  patient: { first_name: string; last_name: string; patient_id: string };
};
type Context = {
  snapshot: ClaimSnapshot;
  issues: ClaimIssue[];
  consultations: {
    id: string;
    consultation_date: string;
    diagnosis_code: string | null;
  }[];
};
export default function NewClaim() {
  return (
    <Suspense
      fallback={
        <main className="page-shell">
          <p className="empty-state">Loading claim builder…</p>
        </main>
      }
    >
      <ClaimSource />
    </Suspense>
  );
}
function ClaimSource() {
  const searchParams = useSearchParams();
  return (
    <ClaimBuilder
      key={searchParams.get("invoice_id") || "new"}
      initialInvoice={searchParams.get("invoice_id") || ""}
    />
  );
}
function ClaimBuilder({ initialInvoice }: { initialInvoice: string }) {
  const router = useRouter();
  const [search, setSearch] = useState(""),
    [invoices, setInvoices] = useState<Invoice[]>([]),
    [invoiceId, setInvoiceId] = useState(initialInvoice),
    [context, setContext] = useState<Context | null>(null),
    [consultationId, setConsultationId] = useState(""),
    [authorization, setAuthorization] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [existing, setExisting] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void claimRequest<{ invoices: Invoice[] }>(
        `/api/claims/automation?q=${encodeURIComponent(search)}`,
        undefined,
        controller.signal,
      )
        .then((r) => setInvoices(r.invoices))
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);
  useEffect(() => {
    if (!invoiceId) return;
    let active = true;
    async function load() {
      setBusy(true);
      setError("");
      setExisting("");
      setContext(null);
      try {
        const result = await claimRequest<Context>(
          `/api/claims/automation?invoice_id=${invoiceId}`,
        );
        if (active) {
          setContext(result);
          setConsultationId(result.snapshot.consultation.id);
          setAuthorization(result.snapshot.authorization_number);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Could not load invoice.");
          if (e instanceof ClaimRequestError)
            setExisting(e.existingClaimId || "");
        }
      } finally {
        if (active) setBusy(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [invoiceId]);
  async function prepare() {
    setBusy(true);
    setError("");
    try {
      const result = await claimRequest<{ claimId: string }>(
        "/api/claims/automation",
        { action: "prepare", invoiceId, consultationId, authorization },
      );
      router.push(`/claims/${result.claimId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare claim.");
      if (e instanceof ClaimRequestError) setExisting(e.existingClaimId || "");
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
              All claims
            </Link>
            <Link href="/claims/settings" className="btn btn-secondary btn-sm">
              Claim settings
            </Link>
          </div>
        </div>
      </header>
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Automatically prepare a claim</h1>
            <p className="page-subtitle">
              Choose the invoice. Patient, membership, practitioner, codes and
              charges fill from your records.
            </p>
          </div>
        </div>
        {error && (
          <div className="alert-error" role="alert">
            {error}{" "}
            {existing && (
              <Link href={`/claims/${existing}`}>Open existing claim</Link>
            )}
          </div>
        )}
        <section className="card">
          <div className="card-body">
            <label className="field">
              <span className="label">
                Find an unpaid invoice by invoice number
              </span>
              <input
                className="input"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice number"
                maxLength={80}
              />
            </label>
            <label className="field">
              <span className="label">Invoice</span>
              <select
                className="input"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                disabled={busy}
              >
                <option value="">Select invoice</option>
                {initialInvoice &&
                  !invoices.some((i) => i.id === initialInvoice) && (
                    <option value={initialInvoice}>
                      Invoice opened from billing
                    </option>
                  )}
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoice_number} · {i.patient.first_name}{" "}
                    {i.patient.last_name} · R {Number(i.balance).toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
        {busy && !context && (
          <p role="status" className="empty-state">
            Loading claim sources…
          </p>
        )}
        {context && (
          <section className="card mt-5">
            <div className="card-header">
              <h2 className="card-title">Review the sources</h2>
            </div>
            <div className="card-body">
              <label className="field">
                <span className="label">Consultation for these services</span>
                <select
                  className="input"
                  value={consultationId}
                  onChange={(e) => setConsultationId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Choose the actual consultation</option>
                  {context.consultations.map((c) => (
                    <option key={c.id} value={c.id}>
                      {new Intl.DateTimeFormat("en-ZA", {
                        timeZone: "Africa/Johannesburg",
                      }).format(new Date(c.consultation_date))}{" "}
                      · {c.diagnosis_code || "ICD-10 missing"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">
                  Scheme authorisation reference, if required
                </span>
                <input
                  className="input"
                  value={authorization}
                  maxLength={100}
                  onChange={(e) => setAuthorization(e.target.value)}
                  disabled={busy}
                />
              </label>
              <p className="page-subtitle mb-4">
                The form below reflects the last loaded source. Prepare the
                claim to apply your consultation selection and run the
                completeness checks.
              </p>
              <ClaimPacketPreview
                snapshot={context.snapshot}
                issues={context.issues}
              />
              <div className="page-actions mt-5">
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={busy}
                  onClick={() => void prepare()}
                >
                  {busy ? "Preparing…" : "Prepare filled claim"}
                </button>
                <Link
                  href={`/patients/${context.snapshot.patient_id}/edit`}
                  className="btn btn-secondary"
                >
                  Correct patient details
                </Link>
                <Link
                  href={`/invoices/${invoiceId}`}
                  className="btn btn-secondary"
                >
                  Open invoice
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
