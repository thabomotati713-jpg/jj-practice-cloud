"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type CheckInResult = {
  success?: boolean;
  alreadyCheckedIn?: boolean;
  patientName?: string;
  status?: string;
  position?: number | null;
  checkedInAt?: string;
  appointmentTime?: string | null;
  error?: string;
};

export default function PatientCheckInPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";
  const [practiceName, setPracticeName] = useState("Your practice");
  const [logoUrl, setLogoUrl] = useState("");
  const [patientId, setPatientId] = useState("");
  const [phone, setPhone] = useState("");
  const [loadingPractice, setLoadingPractice] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);

  useEffect(() => {
    if (!token) return;

    const loadPractice = async () => {
      setLoadingPractice(true);
      const response = await fetch(`/api/check-in?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "This check-in QR code is not available.");
      } else {
        setPracticeName(data.practiceName || "Your practice");
        setLogoUrl(data.logoUrl || "");
      }

      setLoadingPractice(false);
    };

    void loadPractice();
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setCheckingIn(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, patientId, phone }),
      });

      const data: CheckInResult = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not check in.");
        return;
      }

      setResult(data);
    } catch {
      setError("Could not reach the check-in service. Please speak to reception.");
    } finally {
      setCheckingIn(false);
    }
  };

  const statusLabel =
    result?.status === "called"
      ? "You have been called"
      : result?.status === "in_consultation"
        ? "Consultation in progress"
        : "You are checked in";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dff8f5_0,#f7fbfb_38%,#edf2f5_100%)] px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_30px_80px_rgba(15,118,110,0.12)] backdrop-blur-xl">
          <div className="border-b border-slate-100 bg-gradient-to-br from-teal-950 via-teal-900 to-slate-900 px-6 py-8 text-white sm:px-8">
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-16 w-16 rounded-2xl border border-white/20 bg-white/95 object-contain p-2 shadow-lg"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/20 bg-white/10 text-3xl">
                  +
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-200">
                  Reception check-in
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  {loadingPractice ? "Loading practice…" : practiceName}
                </h1>
              </div>
            </div>
            <p className="mt-5 max-w-md text-sm leading-6 text-teal-50/80">
              Check in from your phone and join the live patient queue. Your details are used only to verify your existing patient record.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {result?.success ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-2xl text-white">
                    ✓
                  </div>
                  <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    {statusLabel}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {result.patientName || "Welcome"}
                  </h2>
                  {result.position ? (
                    <div className="mt-5 rounded-2xl bg-white px-5 py-4 shadow-sm">
                      <p className="text-sm text-slate-500">Current queue position</p>
                      <p className="mt-1 text-4xl font-bold text-teal-800">#{result.position}</p>
                    </div>
                  ) : null}
                  {result.appointmentTime ? (
                    <p className="mt-4 text-sm text-slate-600">
                      Appointment time: <strong>{result.appointmentTime}</strong>
                    </p>
                  ) : null}
                  {result.alreadyCheckedIn ? (
                    <p className="mt-3 text-sm text-slate-600">
                      You were already in the queue, so we kept your existing place.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
                  Please remain near reception and listen for your name. If your details or symptoms have changed, tell the receptionist.
                </div>

                <button
                  type="button"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700"
                  onClick={() => {
                    setResult(null);
                    setPatientId("");
                    setPhone("");
                  }}
                >
                  Check in another patient
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700" htmlFor="patient-number">
                    Patient number
                  </label>
                  <input
                    id="patient-number"
                    value={patientId}
                    onChange={(event) => setPatientId(event.target.value)}
                    autoComplete="off"
                    required
                    placeholder="e.g. PT-00123"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700" htmlFor="phone">
                    Mobile number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    autoComplete="tel"
                    required
                    placeholder="e.g. 082 123 4567"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Use the mobile number already saved on your patient file.
                  </p>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={checkingIn || loadingPractice || Boolean(error && !practiceName)}
                  className="w-full rounded-2xl bg-teal-800 px-4 py-4 text-base font-semibold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {checkingIn ? "Adding you to the queue…" : "Check in & join the queue"}
                </button>

                <p className="text-center text-xs leading-5 text-slate-500">
                  Don’t know your patient number? Please ask reception for assistance.
                </p>
              </form>
            )}
          </div>
        </section>

        <p className="mt-5 text-center text-xs text-slate-500">
          Powered by J&J PracticeCloud · Secure practice workflow
        </p>
      </div>
    </main>
  );
}
