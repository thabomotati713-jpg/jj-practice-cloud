"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SPECIALTIES } from "../../../../lib/specialties";
import { supabase } from "../../../../lib/supabase";

export default function EditStaff({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [id, setId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("");
  const [specialty, setSpecialty] = useState("general");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    const { id: staffId } = await params;
    setId(staffId);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("practice_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      setError("Your practice profile could not be found.");
      setLoading(false);
      return;
    }

    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select(
        "id, first_name, last_name, display_name, role, email, phone, active"
      )
      .eq("id", staffId)
      .eq("practice_id", profile.practice_id)
      .single();

    if (staffError || !staff) {
      setError(staffError?.message || "Staff member could not be found.");
      setLoading(false);
      return;
    }

    setFirstName(staff.first_name || "");
    setLastName(staff.last_name || "");
    setDisplayName(staff.display_name || "");
    setRole(staff.role || "");
    setEmail(staff.email || "");
    setPhone(staff.phone || "");
    setActive(staff.active ?? true);

    // Best-effort: the specialty column may not exist pre-migration.
    const { data: specRow } = await supabase
      .from("staff")
      .select("specialty")
      .eq("id", staffId)
      .maybeSingle();

    if (specRow && "specialty" in specRow) {
      setSpecialty((specRow as { specialty: string | null }).specialty || "general");
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    const staffName =
      [firstName, lastName].filter(Boolean).join(" ") || "this staff member";

    const confirmed = window.confirm(
      `Delete ${staffName} permanently? Their login will be removed and this cannot be undone.`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Your session has expired. Please sign in again.");
        setSaving(false);
        return;
      }

      const response = await fetch(`/api/staff/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Could not delete the staff member.");
        setSaving(false);
        return;
      }

      router.push("/staff");
    } catch (deleteError) {
      console.error(deleteError);
      setError("Something went wrong while deleting the staff member.");
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    setSaving(true);
    setError("");

    const { error: updateError } = await supabase
      .from("staff")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name:
          displayName.trim() ||
          `${firstName.trim()} ${lastName.trim()}`,
        role: role.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        active,
      })
      .eq("id", id);

    // Best-effort specialty update — ignore failures on pre-migration DBs.
    await supabase
      .from("staff")
      .update({ specialty })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    window.location.href = "/staff";
  };

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-inner">
          <div className="card mx-auto max-w-3xl">
            <div className="empty-state">Loading staff member...</div>
          </div>
        </div>
      </main>
    );
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
              Back to Staff
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Edit Staff</h1>
            <p className="page-subtitle">Update staff member details</p>
          </div>
        </div>

        <form
          onSubmit={handleSave}
          className="card mx-auto max-w-3xl"
        >
          <div className="card-body">
            {error && <div className="alert-error">{error}</div>}

            <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
              <label className="field">
                <span className="label">First Name *</span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="input"
                />
              </label>

              <label className="field">
                <span className="label">Last Name *</span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="input"
                />
              </label>

              <label className="field">
                <span className="label">Display Name</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input"
                />
              </label>

              <label className="field">
                <span className="label">Role</span>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="input"
                  placeholder="Doctor, Reception, Nurse..."
                />
              </label>

              <label className="field">
                <span className="label">Specialty</span>
                <select
                  className="input"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                >
                  {SPECIALTIES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="label">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                />
              </label>

              <label className="field">
                <span className="label">Phone</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                />
              </label>
            </div>

            <div className="alert-info">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span className="font-semibold">Active staff member</span>
              </label>
            </div>

            <div className="page-actions">
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary w-full"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="btn btn-danger w-full"
              >
                {saving ? "Working..." : "Delete Staff Member"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
