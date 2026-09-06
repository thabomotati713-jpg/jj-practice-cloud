 "use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";

export default function EditStaff({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("");
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

    setLoading(false);
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

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    window.location.href = "/staff";
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow">
          Loading staff member...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Edit Staff
            </h1>
            <p className="text-sm text-slate-500">
              Update staff member details
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/staff";
            }}
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Back to Staff
          </button>
        </div>

        <form
          onSubmit={handleSave}
          className="space-y-6 rounded-xl bg-white p-6 shadow"
        >
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                First Name *
              </label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Last Name *
              </label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Display Name
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Role
              </label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Doctor, Reception, Nurse..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Phone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-slate-700">
              Active staff member
            </span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </main>
  );
}
