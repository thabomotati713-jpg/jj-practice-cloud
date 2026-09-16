"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const logoUrl =
    "https://gdsxouwknkeyhijdgiqg.supabase.co/storage/v1/object/public/practice-logos/64ca98ac-7248-4949-82ff-704d593fedef/04a54e21-92a0-4be0-a1fc-f731b69c8d10.jpg";

  const handleSignIn = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !data.user) {
      setError(
        signInError?.message ||
          "Could not sign in."
      );

      setLoading(false);
      return;
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role, active, practice_id")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();

      setError(
        "Your user profile could not be found."
      );

      setLoading(false);
      return;
    }

    if (!profile.active) {
      await supabase.auth.signOut();

      setError(
        "Your account is inactive. Please contact your administrator."
      );

      setLoading(false);
      return;
    }

    /*
     * Superusers do not belong to a practice for
     * normal practice access purposes.
     */
    if (profile.role === "superuser") {
      setLoading(false);
      window.location.href = "/superuser";
      return;
    }

    if (!profile.practice_id) {
      await supabase.auth.signOut();

      setError(
        "Your account is not linked to a practice."
      );

      setLoading(false);
      return;
    }

    const {
      data: practice,
      error: practiceError,
    } = await supabase
      .from("practices")
      .select("active")
      .eq("id", profile.practice_id)
      .single();

    if (practiceError || !practice) {
      await supabase.auth.signOut();

      setError(
        "Your practice could not be found."
      );

      setLoading(false);
      return;
    }

    if (!practice.active) {
      await supabase.auth.signOut();

      setError(
        "This practice is currently disabled. Please contact J&J Practice Cloud."
      );

      setLoading(false);
      return;
    }

    setLoading(false);
    window.location.href = "/dashboard";
  };

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-[#123339] px-8 py-10 text-white lg:w-[45%] lg:px-14 lg:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#2b9a95] opacity-20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-[#4ab5ae] opacity-10 blur-3xl"
        />

        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/20">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="J&J Practice Cloud logo"
                className="h-full w-full object-contain p-1.5"
              />
            ) : (
              <span className="text-lg font-bold">J&J</span>
            )}
          </div>

          <div>
            <p className="text-lg font-semibold tracking-tight">
              J&J Practice Cloud
            </p>
            <p className="text-sm text-white/60">
              Practice Management System
            </p>
          </div>
        </div>

        <div className="relative my-12 lg:my-0">
          <h1 className="max-w-md text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Run your whole practice from one secure place.
          </h1>

          <ul className="mt-8 space-y-3 text-sm text-white/75">
            {[
              "Patients, appointments and consultations",
              "Prescriptions, sick notes and inventory",
              "Invoicing and medical aid claims",
              "Staff access controlled per practice",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7dd1c8]"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">
          © 2026 J&J Practice Cloud. All rights reserved.
        </p>
      </section>

      {/* Sign-in panel */}
      <section className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-7 shadow-[0_8px_30px_rgb(15,31,45,0.06)] sm:p-9">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Sign in
            </h2>

            <p className="mt-1.5 text-sm text-slate-500">
              Enter your credentials to access your practice.
            </p>

            <form
              className="mt-8 space-y-5"
              onSubmit={handleSignIn}
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-[#2b9a95] focus:ring-2 focus:ring-[#d7f2ee]"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-16 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-[#2b9a95] focus:ring-2 focus:ring-[#d7f2ee]"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-1 py-0.5 text-xs font-semibold text-[#1f7c7a] hover:text-[#123335]"
                  >
                    {showPassword
                      ? "Hide"
                      : "Show"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-[#1f7c7a]"
                  />
                  Remember me
                </label>

                <button
                  type="button"
                  className="font-medium text-[#1f7c7a] hover:text-[#123335]"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#1f7c7a] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a6464] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Signing in..."
                  : "Sign in"}
              </button>

              {error && (
                <p
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Secure practice management · POPIA compliant storage
          </p>
        </div>
      </section>
    </main>
  );
}
