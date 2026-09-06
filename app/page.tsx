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
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Practice logo"
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <span className="text-2xl font-bold text-blue-700">
                J&J
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            J&J PRACTICE CLOUD
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Practice Management System
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Sign in
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Sign in to access your practice
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={handleSignIn}
          >
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
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
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-20 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-700"
                >
                  {showPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>
            </div>

            {/* Remember / Forgot */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                />
                Remember me
              </label>

              <button
                type="button"
                className="font-medium text-blue-700 hover:text-blue-800"
              >
                Forgot password?
              </button>
            </div>

            {/* Sign In */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-70"
            >
              {loading
                ? "Signing in..."
                : "Sign in"}
            </button>

            {error && (
              <p
                className="text-sm text-red-600"
                role="alert"
              >
                {error}
              </p>
            )}
          </form>

          {/* Footer */}
          <div className="mt-6 border-t border-slate-200 pt-5 text-center">
            <p className="text-xs text-slate-400">
              Secure practice management
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © 2026 J&J Practice Cloud
        </p>
      </div>
    </main>
  );
}
