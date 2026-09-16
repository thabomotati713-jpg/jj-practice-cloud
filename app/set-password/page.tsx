"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "This invitation link is invalid or has expired. Please ask your practice administrator to send a new invitation."
        );
      }

      setChecking(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setError("");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "Your invitation session is invalid or has expired."
        );
        setSaving(false);
        return;
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        console.error("Password update error:", updateError);
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error("Unexpected password setup error:", err);
      setError("Could not set your password. Please try again.");
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <main className="page-shell flex min-h-screen items-center justify-center p-[30px]">
        <div className="card w-full max-w-[500px] p-[30px] text-center">
          Checking your invitation...
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="page-shell flex min-h-screen items-center justify-center p-[30px]">
        <div className="card w-full max-w-[500px] p-[30px] text-center">
          <div className="stat-label mb-2">
            J&J PRACTICE CLOUD
          </div>

          <h1 className="page-title">
            Password Set Successfully
          </h1>

          <p className="page-subtitle mb-6 mt-3 text-left">
            Your staff account is ready. You can now sign in to J&J
            Practice Cloud using your email address and new password.
          </p>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/login";
            }}
            className="btn btn-primary w-full"
          >
            Go to Sign In
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell flex min-h-screen items-center justify-center p-[30px]">
      <div className="card w-full max-w-[500px] p-[30px]">
        <div className="stat-label mb-2">
          J&J PRACTICE CLOUD
        </div>

        <h1 className="page-title">Set Your Password</h1>

        <p className="page-subtitle mb-6 mt-2">
          Create a password for your J&J Practice Cloud staff account.
        </p>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="password" className="label">
              New Password
            </label>

            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="input"
            />
          </div>

          <div className="field">
            <label htmlFor="confirmPassword" className="label">
              Confirm Password
            </label>

            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Enter the password again"
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary w-full"
          >
            {saving ? "Saving Password..." : "Set Password"}
          </button>
        </form>
      </div>
    </main>
  );
}
