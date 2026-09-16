"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function NewStaffPage() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    email: "",
    phone: "",
    role: "",
    active: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: string, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setError("");

    try {
      if (!form.email.trim()) {
        setError("Email address is required for staff login.");
        setSaving(false);
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setError("You must be logged in.");
        setSaving(false);
        return;
      }

      const response = await fetch("/api/staff/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          display_name: form.display_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: form.role,
          active: form.active,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to add staff member.");
        setSaving(false);
        return;
      }

      window.location.href = "/staff";
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Failed to add staff member.");
      setSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <a href="/dashboard" className="app-brand">
            <img
              src="/logo.jpg"
              alt="J&J Practice Cloud"
              className="app-brand-logo"
            />
            <span className="app-brand-name">J&J Practice Cloud</span>
          </a>

          <div className="page-actions">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/staff";
              }}
              className="btn btn-secondary btn-sm"
            >
              ← Back to Staff
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Add Staff Member</h1>
            <p className="page-subtitle">
              Add a doctor, nurse, receptionist or other practice staff
              member.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card mx-auto max-w-[800px]">
          <div className="card-body">
            {error && <div className="alert-error">{error}</div>}

            <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
              <label className="field">
                <span className="label">First Name</span>
                <input
                  required
                  value={form.first_name}
                  onChange={(e) =>
                    updateField("first_name", e.target.value)
                  }
                  className="input"
                />
              </label>

              <label className="field">
                <span className="label">Last Name</span>
                <input
                  required
                  value={form.last_name}
                  onChange={(e) =>
                    updateField("last_name", e.target.value)
                  }
                  className="input"
                />
              </label>

              <label className="field">
                <span className="label">Display Name</span>
                <input
                  value={form.display_name}
                  onChange={(e) =>
                    updateField("display_name", e.target.value)
                  }
                  placeholder="Optional"
                  className="input"
                />
              </label>

              <label className="field">
                <span className="label">Role</span>
                <select
                  required
                  value={form.role}
                  onChange={(e) => updateField("role", e.target.value)}
                  className="input"
                >
                  <option value="">Select a role</option>
                  <option value="ADMIN">Practice Administrator</option>
                  <option value="DOCTOR">Doctor</option>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="FINANCE">Finance / Billing</option>
                  <option value="NURSE">Nurse</option>
                  <option value="INVENTORY">Inventory Manager</option>
                </select>
              </label>

              <label className="field">
                <span className="label">Email</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="Staff member's login email"
                  className="input"
                />
              </label>

              <label className="field">
                <span className="label">Phone</span>
                <input
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="input"
                />
              </label>
            </div>

            <div className="alert-info">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    updateField("active", e.target.checked)
                  }
                />
                <span className="font-semibold">Staff member is active</span>
              </label>
            </div>

            <div className="page-actions mt-2.5">
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/staff";
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? "Saving..." : "Add Staff Member"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
