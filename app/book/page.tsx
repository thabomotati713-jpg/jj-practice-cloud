"use client";

import { useEffect, useState } from "react";

type Step = "identify" | "choose" | "done";

export default function BookPage() {
  const [step, setStep] = useState<Step>("identify");

  const [practiceCode, setPracticeCode] = useState("");
  const [patientId, setPatientId] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const [patientName, setPatientName] = useState("");
  const [openSlots, setOpenSlots] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const todayStr = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  useEffect(() => {
    document.title = "Book an Appointment — J&J Practice Cloud";
  }, []);

  async function post(body: Record<string, string>) {
    const response = await fetch("/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return response.json();
  }

  async function loadAvailability() {
    setError("");
    setLoading(true);

    const data = await post({
      practiceCode,
      patientId,
      phone,
      date,
    });

    setLoading(false);

    if (data.error) {
      setError(data.error);
      return;
    }

    setPatientName(data.patientName || "");
    setOpenSlots(data.openSlots || []);
    setStep("choose");
  }

  async function confirmBooking() {
    if (!time) {
      setError("Please pick a time slot.");
      return;
    }

    setError("");
    setLoading(true);

    const data = await post({
      practiceCode,
      patientId,
      phone,
      date,
      time,
    });

    setLoading(false);

    if (data.error) {
      setError(data.error);
      return;
    }

    setStep("done");
  }

  function reset() {
    setStep("identify");
    setDate("");
    setTime("");
    setOpenSlots([]);
    setError("");
  }

  const inputClasses =
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-[#2b9a95] focus:ring-2 focus:ring-[#d7f2ee]";

  return (
    <main className="flex min-h-screen flex-col bg-[#f4f7f9]">
      <header className="border-b border-white/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <img
            src="/logo.jpg"
            alt="J&J Practice Cloud"
            className="h-10 w-10 rounded-lg object-contain"
          />

          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-900">
              J&J Practice Cloud
            </p>
            <p className="text-xs text-slate-500">
              Online appointment booking
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        {/* Step indicator */}
        <ol className="mb-8 flex items-center gap-2 text-xs font-medium text-slate-400">
          {["Verify", "Choose time", "Confirmed"].map(
            (label, index) => {
              const activeIndex =
                step === "identify"
                  ? 0
                  : step === "choose"
                    ? 1
                    : 2;

              return (
                <li
                  key={label}
                  className={`flex items-center gap-2 ${
                    index === activeIndex
                      ? "text-[#1f7c7a]"
                      : index < activeIndex
                        ? "text-emerald-600"
                        : ""
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      index < activeIndex
                        ? "bg-emerald-100"
                        : index === activeIndex
                          ? "bg-[#1f7c7a] text-white"
                          : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {index < activeIndex ? "✓" : index + 1}
                  </span>
                  {label}
                  {index < 2 && (
                    <span
                      aria-hidden
                      className="ml-1 h-px w-8 bg-slate-300"
                    />
                  )}
                </li>
              );
            }
          )}
        </ol>

        {error && (
          <p
            className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {step === "identify" && (
          <section className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl p-7 shadow-[0_8px_30px_rgb(15,31,45,0.06)] sm:p-9">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Book an appointment
            </h1>

            <p className="mt-1.5 text-sm text-slate-500">
              For registered patients. Verify with your practice code,
              patient number and the phone number on file.
            </p>

            <form
              className="mt-7 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                loadAvailability();
              }}
            >
              <div>
                <label
                  htmlFor="practiceCode"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Practice code
                </label>

                <input
                  id="practiceCode"
                  placeholder="e.g. 773"
                  value={practiceCode}
                  onChange={(event) =>
                    setPracticeCode(event.target.value)
                  }
                  className={inputClasses}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="patientId"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Patient number
                </label>

                <input
                  id="patientId"
                  placeholder="e.g. JJ-000001"
                  value={patientId}
                  onChange={(event) =>
                    setPatientId(event.target.value)
                  }
                  className={inputClasses}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Phone number
                </label>

                <input
                  id="phone"
                  type="tel"
                  placeholder="e.g. 0680862658"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  className={inputClasses}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="date"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Preferred date
                </label>

                <input
                  id="date"
                  type="date"
                  min={todayStr}
                  value={date}
                  onChange={(event) =>
                    setDate(event.target.value)
                  }
                  className={inputClasses}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#1f7c7a] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a6464] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Checking availability..."
                  : "See available times"}
              </button>
            </form>
          </section>
        )}

        {step === "choose" && (
          <section className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl p-7 shadow-[0_8px_30px_rgb(15,31,45,0.06)] sm:p-9">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Pick a time
            </h1>

            <p className="mt-1.5 text-sm text-slate-500">
              {patientName}, available 30-minute slots on{" "}
              {new Date(`${date}T00:00:00`).toLocaleDateString(
                "en-ZA",
                {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                }
              )}
              .
            </p>

            {openSlots.length === 0 ? (
              <div className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Fully booked on this day. Please choose
                another date.
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {openSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTime(slot)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      time === slot
                        ? "border-[#1f7c7a] bg-[#1f7c7a] text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-[#7dd1c8]"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={confirmBooking}
                disabled={loading || !time}
                className="flex-1 rounded-xl bg-[#1f7c7a] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a6464] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Booking..."
                  : `Confirm ${time || "booking"}`}
              </button>

              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Start over
              </button>
            </div>
          </section>
        )}

        {step === "done" && (
          <section className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl p-7 text-center shadow-[0_8px_30px_rgb(15,31,45,0.06)] sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
              ✓
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
              Booking confirmed
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {patientName}, your appointment is scheduled for{" "}
              <strong className="text-slate-900">
                {new Date(
                  `${date}T00:00:00`
                ).toLocaleDateString("en-ZA", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </strong>{" "}
              at{" "}
              <strong className="text-slate-900">{time}</strong>.
              A reminder email will be sent the day before.
            </p>

            <button
              type="button"
              onClick={reset}
              className="mt-8 rounded-xl bg-[#1f7c7a] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a6464]"
            >
              Book another appointment
            </button>
          </section>
        )}
      </div>

      <footer className="border-t border-white/70 bg-white/70 backdrop-blur-xl py-4">
        <p className="text-center text-xs text-slate-400">
          © 2026 J&J Practice Cloud
        </p>
      </footer>
    </main>
  );
}
