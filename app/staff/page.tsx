"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { specialtyLabel } from "../../lib/specialties";

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
  const [specialtyById, setSpecialtyById] = useState<Record<string, string | null>>({});
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

      // Best-effort specialty lookup — tolerates pre-migration DBs.
      let specMap: Record<string, string | null> = {};

      if (!staffError && data) {
        const { data: specRows } = await supabase
          .from("staff")
          .select("id, specialty")
          .eq("practice_id", profile.practice_id);

        if (specRows) {
          specMap = Object.fromEntries(
            (specRows as { id: string; specialty: string | null }[]).map(
              (row) => [row.id, row.specialty]
            )
          );
        }

        setSpecialtyById(specMap);
      }

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
              onClick={() => {
                window.location.href = "/dashboard";
              }}
              className="btn btn-secondary btn-sm"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Staff Management</h1>
            <p className="page-subtitle">
              Manage doctors, nurses, reception staff and other practice
              staff.
            </p>
          </div>

          <div className="page-actions">
            <button
              onClick={() => {
                window.location.href = "/staff/new";
              }}
              className="btn btn-primary"
            >
              + Add Staff
            </button>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <div className="card">
          <div className="card-header">
            <span className="card-title">
              Practice Staff ({staff.length})
            </span>
          </div>

          {loading ? (
            <div className="empty-state">Loading staff...</div>
          ) : staff.length === 0 ? (
            <div className="empty-state">
              <div className="card-title">No staff members yet</div>

              <div>
                Add your first staff member to start managing your practice
                team.
              </div>
            </div>
          ) : (
            <div className="table-wrap rounded-none border-0 shadow-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Specialty</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id}>
                      <td className="font-semibold">
                        {staffName(member)}
                      </td>

                      <td>{member.role || "—"}</td>

                      <td>{specialtyLabel(specialtyById[member.id] ?? null)}</td>

                      <td>{member.email || "—"}</td>

                      <td>{member.phone || "—"}</td>

                      <td>
                        <span
                          className={
                            member.active ? "badge badge-green" : "badge badge-gray"
                          }
                        >
                          {member.active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = `/staff/${member.id}/edit`;
                          }}
                          className="btn btn-secondary btn-sm"
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
