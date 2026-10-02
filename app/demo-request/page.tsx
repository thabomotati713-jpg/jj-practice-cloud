"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const highlights = [
  "QR patient arrival with a live reception queue",
  "Online consultations and appointment workflows",
  "QR-verifiable sick notes and patient documents",
  "Speciality-aware inventory and prescription dispensing",
  "Medical aid claims, invoicing and payment tracking",
  "Role-based staff access and audit-minded workflows",
];

export default function DemoRequestPage() {
  const [form, setForm] = useState({
    contactName: "",
    practiceName: "",
    email: "",
    phone: "",
    specialty: "",
    province: "",
    notes: "",
    companyWebsite: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/marketing/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to submit your request.");
      }

      setDone(true);
      setMessage("Your demo request has been received. We will contact you using the details you supplied.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit your request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/brand/jj-practice-cloud-metallic.svg"
              alt="J&J PracticeCloud"
              className="h-12 w-auto max-w-[220px] object-contain"
            />
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
          >
            Staff sign in
          </Link>
        </header>

        <section className="grid gap-12 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:py-20">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
              South African practice management
            </div>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              See how J&amp;J PracticeCloud connects the whole practice day.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              One cloud workspace for patient records, appointments, consultations,
              claims, billing, stock, prescriptions, staff workflows and the small
              details that usually live in separate systems.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {highlights.map((feature) => (
                <div
                  key={feature}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-200"
                >
                  <span className="mr-2 text-emerald-300">✓</span>
                  {feature}
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-3xl border border-sky-300/15 bg-gradient-to-br from-sky-400/10 to-fuchsia-400/10 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">
                Built to be demonstrated
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Ask for a guided walkthrough using a demo practice so you can see
                the reception queue, patient journey, consultation workflow,
                billing, stock and practice branding in one session.
              </p>
            </div>
          </div>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-sky-950/30 backdrop-blur sm:p-8">
            {done ? (
              <div className="py-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-300/15 text-3xl text-emerald-200">
                  ✓
                </div>
                <h2 className="mt-6 text-2xl font-bold">Demo request received</h2>
                <p className="mt-3 text-slate-300">{message}</p>
                <button
                  type="button"
                  onClick={() => {
                    setDone(false);
                    setMessage("");
                  }}
                  className="mt-8 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold hover:bg-white/10"
                >
                  Submit another request
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">
                  Book a product demo
                </p>
                <h2 className="mt-2 text-2xl font-bold">Tell us about the practice</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  No patient information is needed. These details are only for the
                  product demonstration request.
                </p>

                <form className="mt-7 space-y-4" onSubmit={submit}>
                  <input
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.companyWebsite}
                    onChange={(event) => update("companyWebsite", event.target.value)}
                    aria-hidden="true"
                  />
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Your name *</span>
                    <input
                      required
                      value={form.contactName}
                      onChange={(event) => update("contactName", event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 outline-none ring-0 placeholder:text-slate-500 focus:border-sky-300/60"
                      placeholder="Full name"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Practice name</span>
                    <input
                      value={form.practiceName}
                      onChange={(event) => update("practiceName", event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-sky-300/60"
                      placeholder="Medical centre or practice"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">Email</span>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) => update("email", event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-sky-300/60"
                        placeholder="name@practice.co.za"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">Phone</span>
                      <input
                        value={form.phone}
                        onChange={(event) => update("phone", event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-sky-300/60"
                        placeholder="Mobile number"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">Speciality</span>
                      <input
                        value={form.specialty}
                        onChange={(event) => update("specialty", event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-sky-300/60"
                        placeholder="GP, optometry, dental..."
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">Province</span>
                      <input
                        value={form.province}
                        onChange={(event) => update("province", event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-sky-300/60"
                        placeholder="Gauteng"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">What would you like to see?</span>
                    <textarea
                      rows={4}
                      value={form.notes}
                      onChange={(event) => update("notes", event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-sky-300/60"
                      placeholder="e.g. claims, stock, online consultation, QR check-in..."
                    />
                  </label>

                  {message && !done && (
                    <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">
                      {message}
                    </p>
                  )}

                  <button
                    disabled={saving}
                    className="w-full rounded-xl bg-white px-4 py-3.5 font-bold text-slate-950 transition hover:bg-sky-100 disabled:opacity-60"
                  >
                    {saving ? "Sending request..." : "Request my demo"}
                  </button>
                </form>
              </>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
