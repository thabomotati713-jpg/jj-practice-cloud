"use client";
import { useState } from "react";
import Link from "next/link";
import ClaimPacketPreview from "@/components/ClaimPacketPreview";
import { demoClaim } from "@/lib/claims/demo";
import { localDay, validateClaim } from "@/lib/claims/model";
export default function ClaimsDemo() {
  const [filled, setFilled] = useState(false),
    [missing, setMissing] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [state, setState] = useState("");
  const sample = demoClaim(localDay());
  if (missing) sample.member.number = "";
  const issues = filled ? validateClaim(sample) : [];
  return (
    <main className="page-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/" className="app-brand">
            <span className="app-brand-name">J&J PracticeCloud</span>
          </Link>
          <Link href="/login" className="btn btn-secondary btn-sm">
            Practice sign in
          </Link>
        </div>
      </header>
      <div className="page-inner" style={{ maxWidth: 1100 }}>
        <div className="page-header">
          <div>
            <p className="stat-label">INTERACTIVE PRODUCT DEMONSTRATION</p>
            <h1 className="page-title">From invoice to a prepared claim.</h1>
            <p className="page-subtitle">
              See the form fill, catch missing information, then simulate an
              approved submission.
            </p>
          </div>
          <span className="badge badge-amber">
            Fictional data · sending disabled
          </span>
        </div>
        <div className="alert-info">
          This demonstration stays in memory. Names, identifiers, registration
          details and charges are fictional. Every delivery state below is
          simulated.
        </div>
        <section className="card mt-5">
          <div className="card-body">
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={filled}
                onClick={() => setFilled(true)}
              >
                {filled ? "Form prefilled" : "1. Prefill sample claim"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!filled || Boolean(state)}
                onClick={() => {
                  setMissing((v) => !v);
                  setReviewed(false);
                }}
              >
                {missing
                  ? "Restore membership details"
                  : "2. Demonstrate missing details"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setFilled(false);
                  setMissing(false);
                  setReviewed(false);
                  setState("");
                }}
              >
                Reset demonstration
              </button>
            </div>
            <p className="page-subtitle mt-3">
              In the working app, these fields come from the saved patient,
              consultation, practitioner credentials and itemised invoice.
            </p>
          </div>
        </section>
        {filled && (
          <section className="card mt-5">
            <div className="card-header">
              <h2 className="card-title">Prepared sample form</h2>
            </div>
            <div className="card-body">
              <ClaimPacketPreview snapshot={sample} issues={issues} />
              <div className="alert-info mt-5">
                <strong>Demo destination:</strong> published scheme route
                displayed for review. No email can be sent from this page.
              </div>
              <label className="flex items-start gap-3 mt-5">
                <input
                  type="checkbox"
                  disabled={issues.length > 0 || Boolean(state)}
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                <span>3. Confirm review of this fictional sample.</span>
              </label>
              <div className="page-actions mt-5">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!reviewed || issues.length > 0 || Boolean(state)}
                  onClick={() => setState("Simulated: approved and queued")}
                >
                  Simulate approved submission
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={state !== "Simulated: approved and queued"}
                  onClick={() =>
                    setState(
                      "Simulated: email delivered · scheme response pending",
                    )
                  }
                >
                  Simulate delivery receipt
                </button>
              </div>
              {state && (
                <p role="status" className="alert-success mt-5">
                  {state}
                </p>
              )}
              <p className="page-subtitle mt-3">
                The working app preserves the approved PDF and destination,
                prevents duplicate sends and records delivery separately from
                the scheme’s response.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
