"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type VerifyResult = {
  valid: boolean;
  reason?: string;
  noteNumber?: string | null;
  issueDate?: string;
  startDate?: string;
  endDate?: string;
  patientName?: string;
  practiceName?: string;
  practiceCode?: string;
  practicePhone?: string;
  practiceEmail?: string;
};

function formatDate(date?: string) {
  if (!date) return "—";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function VerifySickNotePage() {
  const params = useParams<{ id: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      if (!params?.id) return;

      try {
        const response = await fetch(
          `/api/verify/sick-note?id=${params.id}`
        );

        if (response.status === 404) {
          setResult({ valid: false, reason: "Sick note not found." });
          return;
        }

        const data = await response.json();
        setResult(data);
      } catch {
        setResult({ valid: false, reason: "Verification failed." });
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, [params?.id]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl p-8 shadow-[0_8px_30px_rgb(15,31,45,0.06)] sm:p-10">
          {loading ? (
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#d7f2ee] border-t-[#1f7c7a]" />
              <p className="mt-4 text-sm text-slate-500">
                Verifying sick note…
              </p>
            </div>
          ) : result?.valid ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-600">
                  ✓
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    Valid sick note
                  </h1>
                  <p className="text-sm text-slate-500">
                    Issued by {result.practiceName}
                    {result.practiceCode
                      ? ` · Practice code ${result.practiceCode}`
                      : ""}
                  </p>
                </div>
              </div>

              <dl className="mt-8 space-y-4 text-sm">
                {[
                  ["Note number", result.noteNumber || "—"],
                  ["Patient", result.patientName || "—"],
                  ["Issue date", formatDate(result.issueDate)],
                  ["Valid from", formatDate(result.startDate)],
                  ["Valid until", formatDate(result.endDate)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border-b border-slate-100 pb-3"
                  >
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-semibold text-slate-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-8 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
                This note was verified directly against the records of{" "}
                {result.practiceName}. If you suspect forgery, contact the
                practice
                {result.practicePhone ? ` on ${result.practicePhone}` : ""}
                {result.practiceEmail ? ` or ${result.practiceEmail}` : ""}.
              </p>
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-xl text-red-600">
                ✕
              </div>
              <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">
                Not verified
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {result?.reason ||
                  "This sick note could not be found in the issuing practice's records. It may be forged or mistyped."}
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          J&J Practice Cloud · Secure document verification
        </p>
      </div>
    </main>
  );
}
