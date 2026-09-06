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
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          padding: "30px",
        }}
      >
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "30px",
            maxWidth: "500px",
            width: "100%",
            textAlign: "center",
          }}
        >
          Checking your invitation...
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          padding: "30px",
        }}
      >
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "30px",
            maxWidth: "500px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#2563eb",
              marginBottom: "8px",
            }}
          >
            J&J PRACTICE CLOUD
          </div>

          <h1
            style={{
              margin: "0 0 12px",
              fontSize: "28px",
              color: "#1f2937",
            }}
          >
            Password Set Successfully
          </h1>

          <p
            style={{
              color: "#6b7280",
              lineHeight: 1.6,
              marginBottom: "25px",
            }}
          >
            Your staff account is ready. You can now sign in to J&J
            Practice Cloud using your email address and new password.
          </p>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "8px",
              border: "none",
              background: "#2563eb",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Go to Sign In
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: "30px",
      }}
    >
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "30px",
          maxWidth: "500px",
          width: "100%",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#2563eb",
            marginBottom: "8px",
          }}
        >
          J&J PRACTICE CLOUD
        </div>

        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "28px",
            color: "#1f2937",
          }}
        >
          Set Your Password
        </h1>

        <p
          style={{
            color: "#6b7280",
            lineHeight: 1.6,
            marginBottom: "25px",
          }}
        >
          Create a password for your J&J Practice Cloud staff account.
        </p>

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: "14px",
              borderRadius: "8px",
              marginBottom: "20px",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "18px" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
                color: "#374151",
              }}
            >
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
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "25px" }}>
            <label
              htmlFor="confirmPassword"
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
                color: "#374151",
              }}
            >
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
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "8px",
              border: "none",
              background: saving ? "#93c5fd" : "#2563eb",
              color: "white",
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving Password..." : "Set Password"}
          </button>
        </form>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  boxSizing: "border-box",
  fontSize: "15px",
};
