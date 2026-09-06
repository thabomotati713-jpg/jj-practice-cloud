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
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "30px",
      }}
    >
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        <button
          type="button"
          onClick={() => {
            window.location.href = "/staff";
          }}
          style={{
            padding: "10px 15px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            background: "white",
            cursor: "pointer",
            fontWeight: 600,
            marginBottom: "25px",
          }}
        >
          ← Back to Staff
        </button>

        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "30px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#2563eb",
              marginBottom: "5px",
            }}
          >
            J&J PRACTICE CLOUD
          </div>

          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "30px",
              color: "#1f2937",
            }}
          >
            Add Staff Member
          </h1>

          <p
            style={{
              color: "#6b7280",
              marginBottom: "30px",
            }}
          >
            Add a doctor, nurse, receptionist or other practice staff member.
          </p>

          {error && (
            <div
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                padding: "14px",
                borderRadius: "8px",
                marginBottom: "20px",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
              }}
            >
              <div>
                <label>First Name</label>
                <input
                  required
                  value={form.first_name}
                  onChange={(e) =>
                    updateField("first_name", e.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Last Name</label>
                <input
                  required
                  value={form.last_name}
                  onChange={(e) =>
                    updateField("last_name", e.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Display Name</label>
                <input
                  value={form.display_name}
                  onChange={(e) =>
                    updateField("display_name", e.target.value)
                  }
                  placeholder="Optional"
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Role</label>
                <select
                  required
                  value={form.role}
                  onChange={(e) => updateField("role", e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select a role</option>
                  <option value="ADMIN">Practice Administrator</option>
                  <option value="DOCTOR">Doctor</option>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="FINANCE">Finance / Billing</option>
                  <option value="NURSE">Nurse</option>
                  <option value="INVENTORY">Inventory Manager</option>
                </select>
              </div>

              <div>
                <label>Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="Staff member's login email"
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: "25px",
                padding: "15px",
                background: "#f8fafc",
                borderRadius: "8px",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    updateField("active", e.target.checked)
                  }
                />
                <span style={{ fontWeight: 600 }}>Staff member is active</span>
              </label>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "30px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/staff";
                }}
                style={{
                  padding: "12px 20px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "12px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2563eb",
                  color: "white",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving..." : "Add Staff Member"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: "7px",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "15px",
};
