"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Staff = {
  id: string;
  practice_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  active: boolean;
  created_at: string;
};

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStaff() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You must be logged in.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("practice_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.practice_id) {
        console.error("Profile error:", profileError);
        setError("Could not determine your practice.");
        setLoading(false);
        return;
      }

      const { data, error: staffError } = await supabase
        .from("staff")
        .select(
          "id, practice_id, first_name, last_name, display_name, email, phone, role, active, created_at"
        )
        .eq("practice_id", profile.practice_id)
        .order("created_at", { ascending: false });

      if (staffError) {
        console.error("Staff error:", staffError);
        setError(staffError.message);
        setLoading(false);
        return;
      }

      setStaff(data || []);
    } catch (err) {
      console.error("Unexpected staff error:", err);
      setError("Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  function staffName(member: Staff) {
    if (member.display_name) return member.display_name;

    return [member.first_name, member.last_name]
      .filter(Boolean)
      .join(" ") || "Unnamed Staff";
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
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "30px",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <div>
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
                margin: 0,
                fontSize: "32px",
                color: "#1f2937",
              }}
            >
              Staff Management
            </h1>

            <p
              style={{
                marginTop: "8px",
                color: "#6b7280",
              }}
            >
              Manage doctors, nurses, reception staff and other practice staff.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => {
                window.location.href = "/dashboard";
              }}
              style={{
                padding: "11px 16px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                background: "white",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              ← Dashboard
            </button>

            <button
              onClick={() => {
                window.location.href = "/staff/new";
              }}
              style={{
                padding: "11px 16px",
                borderRadius: "8px",
                border: "none",
                background: "#2563eb",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              + Add Staff
            </button>
          </div>
        </div>

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

        <div
          style={{
            background: "white",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "20px",
              borderBottom: "1px solid #e5e7eb",
              fontWeight: 700,
              color: "#1f2937",
            }}
          >
            Practice Staff ({staff.length})
          </div>

          {loading ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              Loading staff...
            </div>
          ) : staff.length === 0 ? (
            <div
              style={{
                padding: "50px",
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                No staff members yet
              </div>

              <div>
                Add your first staff member to start managing your practice
                team.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8fafc",
                      textAlign: "left",
                    }}
                  >
                    <th style={{ padding: "14px 18px" }}>Name</th>
                    <th style={{ padding: "14px 18px" }}>Role</th>
                    <th style={{ padding: "14px 18px" }}>Email</th>
                    <th style={{ padding: "14px 18px" }}>Phone</th>
                    <th style={{ padding: "14px 18px" }}>Status</th>
                    <th style={{ padding: "14px 18px" }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {staff.map((member) => (
                    <tr
                      key={member.id}
                      style={{
                        borderTop: "1px solid #e5e7eb",
                      }}
                    >
                      <td
                        style={{
                          padding: "16px 18px",
                          fontWeight: 600,
                          color: "#1f2937",
                        }}
                      >
                        {staffName(member)}
                      </td>

                      <td style={{ padding: "16px 18px", color: "#4b5563" }}>
                        {member.role || "—"}
                      </td>

                      <td style={{ padding: "16px 18px", color: "#4b5563" }}>
                        {member.email || "—"}
                      </td>

                      <td style={{ padding: "16px 18px", color: "#4b5563" }}>
                        {member.phone || "—"}
                      </td>

                      <td style={{ padding: "16px 18px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "5px 10px",
                            borderRadius: "999px",
                            fontSize: "13px",
                            fontWeight: 700,
                            background: member.active ? "#dcfce7" : "#fee2e2",
                            color: member.active ? "#166534" : "#991b1b",
                          }}
                        >
                          {member.active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td style={{ padding: "16px 18px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = `/staff/${member.id}/edit`;
                          }}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "8px",
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            color: "#111827",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
