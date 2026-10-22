"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { claimRequest, downloadClaim } from "@/lib/claims/client";
import type { ClaimSnapshot, ClaimIssue } from "@/lib/claims/model";
import ClaimPacketPreview from "./ClaimPacketPreview";
type Data = {
  claim: { id: string; invoice_id: string | null; status: string };
  packet: {
    snapshot: ClaimSnapshot;
    fingerprint: string;
    issues: ClaimIssue[];
  } | null;
  submission: {
    id: string;
    state: string;
    recipient: string;
    label: string;
    last_error: string | null;
    approved_at: string;
    provider_message_id: string | null;
  } | null;
  route: { name: string; email: string } | null;
  submissionEnabled: boolean;
  emailConfigured: boolean;
  events: {
    id: string;
    event_type: string;
    message: string | null;
    created_at: string;
  }[];
};
export default function ClaimSubmissionPanel({
  claimId,
  onManaged,
  onComplete,
}: {
  claimId: string;
  onManaged: (value: boolean) => void;
  onComplete: () => void;
}) {
  const [data, setData] = useState<Data | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [authority, setAuthority] = useState(false),
    [consultationId, setConsultationId] = useState(""),
    [authorization, setAuthorization] = useState(""),
    [consultations, setConsultations] = useState<
      { id: string; consultation_date: string; diagnosis_code: string | null }[]
    >([]);
  const load = useCallback(async () => {
    try {
      const r = await claimRequest<Data>(
        `/api/claims/automation?claim_id=${claimId}`,
      );
      setError("");
      setData(r);
      onManaged(Boolean(r.packet));
      setReviewed(false);
      setAuthority(false);
      setConsultationId(r.packet?.snapshot.consultation.id || "");
      setAuthorization(r.packet?.snapshot.authorization_number || "");
      if (r.claim.invoice_id) {
        try {
          const context = await claimRequest<{
            consultations: typeof consultations;
            snapshot: ClaimSnapshot;
          }>(`/api/claims/automation?invoice_id=${r.claim.invoice_id}`);
          setConsultations(context.consultations);
          if (!r.packet) setConsultationId(context.snapshot.consultation.id);
        } catch {
          setConsultations([]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim workflow unavailable.");
    } finally {
      setBusy(false);
    }
  }, [claimId, onManaged]);
  useEffect(() => {
    // Loader state updates follow the awaited API response, never the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  async function prepare() {
    if (!data?.claim.invoice_id) return;
    setBusy(true);
    setError("");
    try {
      await claimRequest("/api/claims/automation", {
        action: "prepare",
        claimId,
        invoiceId: data.claim.invoice_id,
        consultationId,
        authorization,
      });
      await load();
      setNotice(
        "Claim form refreshed from the saved records. Review the completed form before submission.",
      );
      onComplete();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The claim could not be prepared.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!data?.packet) return;
    setBusy(true);
    setError("");
    try {
      await claimRequest("/api/claims/automation", {
        action: "approve",
        claimId,
        fingerprint: data.packet.fingerprint,
        reviewed,
        authority,
      });
      await load();
      onComplete();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Submission could not be completed. Check its delivery status before taking further action.";
      await load();
      setError(message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError("");
    try {
      await downloadClaim(claimId);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The PDF could not be downloaded.",
      );
    } finally {
      setBusy(false);
    }
  }
  const changed = Boolean(
    data?.packet &&
    (consultationId !== data.packet.snapshot.consultation.id ||
      authorization !== data.packet.snapshot.authorization_number),
  );
  return (
    <section
      className="card mb-5"
      style={{ borderTop: "3px solid var(--pc-action)" }}
    >
      <div className="card-header">
        <div>
          <h2 className="card-title">Automated claim submission</h2>
          <p className="page-subtitle">
            Filled form, completeness checks, scheme routing and delivery
            history.
          </p>
        </div>
        <Link className="btn btn-secondary btn-sm" href="/claims/settings">
          Claim settings
        </Link>
      </div>
      <div className="card-body">
        {error && (
          <p className="alert-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="alert-info" role="status">
            {notice}
          </p>
        )}
        {!data && busy && <p role="status">Loading the claim workflow…</p>}
        {data && !data.submission && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="field">
                <span className="label">Treating consultation</span>
                <select
                  className="input"
                  value={consultationId}
                  disabled={busy}
                  onChange={(e) => {
                    setConsultationId(e.target.value);
                    setReviewed(false);
                    setAuthority(false);
                  }}
                >
                  <option value="">Select the actual consultation</option>
                  {consultations.map((c) => (
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
                  disabled={busy}
                  onChange={(e) => {
                    setAuthorization(e.target.value);
                    setReviewed(false);
                    setAuthority(false);
                  }}
                />
              </label>
            </div>
            <div className="page-actions mb-5">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={
                  busy ||
                  !data.claim.invoice_id ||
                  !["draft", "ready"].includes(data.claim.status)
                }
                onClick={() => void prepare()}
              >
                {data.packet ? "Refresh filled claim" : "Prepare filled claim"}
              </button>
              {data.packet && (
                <Link
                  href={`/patients/${data.packet.snapshot.patient_id}/edit`}
                  className="btn btn-secondary"
                >
                  Correct patient details
                </Link>
              )}
            </div>
            {changed && (
              <p className="alert-info">
                Refresh the filled claim to apply your consultation or
                authorisation change.
              </p>
            )}
          </>
        )}
        {data?.packet && (
          <>
            <ClaimPacketPreview
              snapshot={data.packet.snapshot}
              issues={data.packet.issues}
            />
            <div className="page-actions mt-5">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void download()}
              >
                Download claim & invoice PDF
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void load();
                }}
              >
                Refresh delivery status
              </button>
            </div>
          </>
        )}
        {data?.packet && !data.submission && (
          <div className="mt-5 space-y-4">
            <div className="alert-info">
              <strong>Destination:</strong>{" "}
              {data.route
                ? `${data.route.name} · ${data.route.email}`
                : "No confirmed email route for this scheme. Use Claim settings, or download the PDF for the scheme’s approved portal or switch."}
            </div>
            {(!data.submissionEnabled || !data.emailConfigured) && (
              <p className="page-subtitle">
                {!data.submissionEnabled
                  ? "Email submissions are paused in Claim settings. "
                  : ""}
                {!data.emailConfigured
                  ? "A verified email sender must be configured before sending."
                  : ""}
              </p>
            )}
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={reviewed}
                disabled={busy || changed || data.packet.issues.length > 0}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              <span>
                I reviewed the completed form, service dates, tariff/NAPPI and
                ICD-10 codes, amounts, scheme authorisations and
                supporting-document requirements. This PDF contains the claim
                form and itemised invoice; cases requiring other documents will
                use the scheme’s approved channel.
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={authority}
                disabled={busy || !data.route}
                onChange={(e) => setAuthority(e.target.checked)}
              />
              <span>
                I am authorised to submit this claim and send the displayed
                patient identifiers, membership details, diagnostic codes and
                charges to {data.route?.email || "the confirmed scheme inbox"}.
              </span>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                busy ||
                changed ||
                !reviewed ||
                !authority ||
                !data.route ||
                !data.submissionEnabled ||
                !data.emailConfigured ||
                data.packet.issues.length > 0
              }
              onClick={() => void approve()}
            >
              {busy ? "Processing…" : "Approve & send automatically"}
            </button>
            <p className="page-subtitle">
              Email delivery and scheme acceptance are tracked separately. The
              app does not infer benefits, authorisations, payment or approval.
            </p>
          </div>
        )}
        {data?.submission && (
          <div className="mt-5">
            <h3 className="card-title">{data.submission.label}</h3>
            <p>Destination: {data.submission.recipient}</p>
            <p className="page-subtitle">
              Approved{" "}
              {new Date(data.submission.approved_at).toLocaleString("en-ZA", {
                timeZone: "Africa/Johannesburg",
              })}
            </p>
            {data.submission.last_error && (
              <p className="alert-error mt-3">{data.submission.last_error}</p>
            )}
            <p className="page-subtitle mt-3">
              The approved PDF is sealed. A second click cannot create a
              duplicate submission. Uncertain delivery requires reconciliation
              with the scheme before any new submission.
            </p>
            <details className="mt-4">
              <summary className="label cursor-pointer">
                Submission history
              </summary>
              <ul>
                {data.events.map((e) => (
                  <li key={e.id} className="py-2">
                    {e.event_type.replaceAll("_", " ")} ·{" "}
                    {new Date(e.created_at).toLocaleString("en-ZA", {
                      timeZone: "Africa/Johannesburg",
                    })}
                    {e.message && <p className="page-subtitle">{e.message}</p>}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
        {!data?.packet &&
          data &&
          !["draft", "ready"].includes(data.claim.status) && (
            <p className="alert-info">
              This existing claim was submitted or closed outside this workflow.
              Automatic resubmission is disabled.
            </p>
          )}
      </div>
    </section>
  );
}
