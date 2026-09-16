"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";

type Patient = {
  id: string;
  patient_id: string;
  title: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  id_number: string | null;
  passport_number: string | null;
  phone: string | null;
  alternative_phone: string | null;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  occupation: string | null;
  marital_status: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  medical_aid_provider: string | null;
  medical_aid_number: string | null;
  medical_aid_plan: string | null;
  medical_aid_dependent_code: string | null;
  medical_aid_main_member: string | null;
  blood_type: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  status: string | null;
  notes: string | null;
};

function statusBadgeClass(status: string | null | undefined): string {
  const s = (status || "").toLowerCase();
  if (["paid", "completed", "active", "in stock"].includes(s)) return "badge badge-green";
  if (
    ["pending", "submitted", "partially paid", "scheduled", "confirmed"].includes(s)
  )
    return "badge badge-blue";
  if (["low stock", "no show"].includes(s)) return "badge badge-amber";
  if (["cancelled", "rejected", "overdue", "out of stock"].includes(s))
    return "badge badge-red";
  return "badge badge-gray";
}

export default function EditPatient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [practiceId, setPracticeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPatient();
  }, []);

  const loadPatient = async () => {
    const routeParams = await params;

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

    setPracticeId(profile.practice_id);

    const { data, error: patientError } = await supabase
      .from("patients")
      .select("*")
      .eq("id", routeParams.id)
      .eq("practice_id", profile.practice_id)
      .single();

    if (patientError || !data) {
      setError("Patient could not be found.");
      setLoading(false);
      return;
    }

    const p = data as Patient;

    setPatient(p);

    setForm({
      title: p.title || "",
      first_name: p.first_name || "",
      middle_name: p.middle_name || "",
      last_name: p.last_name || "",
      date_of_birth: p.date_of_birth || "",
      gender: p.gender || "",
      id_number: p.id_number || "",
      passport_number: p.passport_number || "",
      phone: p.phone || "",
      alternative_phone: p.alternative_phone || "",
      email: p.email || "",
      address_line_1: p.address_line_1 || "",
      address_line_2: p.address_line_2 || "",
      city: p.city || "",
      province: p.province || "",
      postal_code: p.postal_code || "",
      country: p.country || "",
      occupation: p.occupation || "",
      marital_status: p.marital_status || "",
      emergency_contact_name: p.emergency_contact_name || "",
      emergency_contact_relationship:
        p.emergency_contact_relationship || "",
      emergency_contact_phone: p.emergency_contact_phone || "",
      medical_aid_provider: p.medical_aid_provider || "",
      medical_aid_number: p.medical_aid_number || "",
      medical_aid_plan: p.medical_aid_plan || "",
      medical_aid_dependent_code:
        p.medical_aid_dependent_code || "",
      medical_aid_main_member: p.medical_aid_main_member || "",
      blood_type: p.blood_type || "",
      allergies: p.allergies || "",
      chronic_conditions: p.chronic_conditions || "",
      status: p.status || "active",
      notes: p.notes || "",
    });

    setLoading(false);
  };

  const updateField = (name: string, value: string) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patient || !practiceId) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("patients")
      .update({
        title: form.title || null,
        first_name: form.first_name,
        middle_name: form.middle_name || null,
        last_name: form.last_name,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        id_number: form.id_number || null,
        passport_number: form.passport_number || null,
        phone: form.phone || null,
        alternative_phone: form.alternative_phone || null,
        email: form.email || null,
        address_line_1: form.address_line_1 || null,
        address_line_2: form.address_line_2 || null,
        city: form.city || null,
        province: form.province || null,
        postal_code: form.postal_code || null,
        country: form.country || null,
        occupation: form.occupation || null,
        marital_status: form.marital_status || null,
        emergency_contact_name:
          form.emergency_contact_name || null,
        emergency_contact_relationship:
          form.emergency_contact_relationship || null,
        emergency_contact_phone:
          form.emergency_contact_phone || null,
        medical_aid_provider:
          form.medical_aid_provider || null,
        medical_aid_number:
          form.medical_aid_number || null,
        medical_aid_plan:
          form.medical_aid_plan || null,
        medical_aid_dependent_code:
          form.medical_aid_dependent_code || null,
        medical_aid_main_member:
          form.medical_aid_main_member || null,
        blood_type: form.blood_type || null,
        allergies: form.allergies || null,
        chronic_conditions:
          form.chronic_conditions || null,
        status: form.status || "active",
        notes: form.notes || null,
      })
      .eq("id", patient.id)
      .eq("practice_id", practiceId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSuccess("Patient updated successfully.");
    setSaving(false);

    setTimeout(() => {
      window.location.href = `/patients/${patient.id}`;
    }, 700);
  };

  if (loading) {
    return (
      <main className="page-shell flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--muted)]">Loading patient...</p>
      </main>
    );
  }

  if (error && !patient) {
    return (
      <main className="page-shell">
        <div className="page-inner">
          <div className="card">
            <div className="card-body">
              <p className="alert-error">{error}</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!patient) return null;

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

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="btn btn-secondary btn-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <p className="text-sm font-semibold text-[var(--brand-600)]">
              {patient.patient_id}
            </p>
            <h1 className="page-title">Edit Patient</h1>
            <p className="page-subtitle">
              Update this patient&apos;s personal, contact and medical details.
            </p>
          </div>

          <div className="page-actions">
            <span className={statusBadgeClass(patient.status)}>
              {patient.status || "active"}
            </span>
            <button
              type="button"
              onClick={() => {
                window.location.href = `/patients/${patient.id}`;
              }}
              className="btn btn-secondary btn-sm"
            >
              ← Back to Patient
            </button>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}
        {success && <div className="alert-success">{success}</div>}

        <form onSubmit={handleSave}>
          <Section title="Personal Information">
            <Field
              label="Title"
              name="title"
              value={form.title}
              onChange={updateField}
              placeholder="Mr, Mrs, Ms, Dr..."
            />

            <Field
              label="First name"
              name="first_name"
              value={form.first_name}
              onChange={updateField}
              required
            />

            <Field
              label="Middle name"
              name="middle_name"
              value={form.middle_name}
              onChange={updateField}
            />

            <Field
              label="Last name"
              name="last_name"
              value={form.last_name}
              onChange={updateField}
              required
            />

            <Field
              label="Date of birth"
              name="date_of_birth"
              type="date"
              value={form.date_of_birth}
              onChange={updateField}
            />

            <Field
              label="Gender"
              name="gender"
              value={form.gender}
              onChange={updateField}
            />

            <Field
              label="ID number"
              name="id_number"
              value={form.id_number}
              onChange={updateField}
            />

            <Field
              label="Passport number"
              name="passport_number"
              value={form.passport_number}
              onChange={updateField}
            />

            <Field
              label="Occupation"
              name="occupation"
              value={form.occupation}
              onChange={updateField}
            />

            <Field
              label="Marital status"
              name="marital_status"
              value={form.marital_status}
              onChange={updateField}
            />

            <Field
              label="Blood type"
              name="blood_type"
              value={form.blood_type}
              onChange={updateField}
            />

            <Field
              label="Status"
              name="status"
              value={form.status}
              onChange={updateField}
            />
          </Section>

          <Section title="Contact Information">
            <Field
              label="Phone"
              name="phone"
              value={form.phone}
              onChange={updateField}
            />

            <Field
              label="Alternative phone"
              name="alternative_phone"
              value={form.alternative_phone}
              onChange={updateField}
            />

            <Field
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={updateField}
            />

            <Field
              label="Address line 1"
              name="address_line_1"
              value={form.address_line_1}
              onChange={updateField}
            />

            <Field
              label="Address line 2"
              name="address_line_2"
              value={form.address_line_2}
              onChange={updateField}
            />

            <Field
              label="City"
              name="city"
              value={form.city}
              onChange={updateField}
            />

            <Field
              label="Province"
              name="province"
              value={form.province}
              onChange={updateField}
            />

            <Field
              label="Postal code"
              name="postal_code"
              value={form.postal_code}
              onChange={updateField}
            />

            <Field
              label="Country"
              name="country"
              value={form.country}
              onChange={updateField}
            />
          </Section>

          <Section title="Emergency Contact">
            <Field
              label="Name"
              name="emergency_contact_name"
              value={form.emergency_contact_name}
              onChange={updateField}
            />

            <Field
              label="Relationship"
              name="emergency_contact_relationship"
              value={form.emergency_contact_relationship}
              onChange={updateField}
            />

            <Field
              label="Phone"
              name="emergency_contact_phone"
              value={form.emergency_contact_phone}
              onChange={updateField}
            />
          </Section>

          <Section title="Medical Aid">
            <Field
              label="Provider"
              name="medical_aid_provider"
              value={form.medical_aid_provider}
              onChange={updateField}
            />

            <Field
              label="Medical aid number"
              name="medical_aid_number"
              value={form.medical_aid_number}
              onChange={updateField}
            />

            <Field
              label="Plan"
              name="medical_aid_plan"
              value={form.medical_aid_plan}
              onChange={updateField}
            />

            <Field
              label="Dependent code"
              name="medical_aid_dependent_code"
              value={form.medical_aid_dependent_code}
              onChange={updateField}
            />

            <Field
              label="Main member"
              name="medical_aid_main_member"
              value={form.medical_aid_main_member}
              onChange={updateField}
            />
          </Section>

          <Section title="Medical Information">
            <TextArea
              label="Allergies"
              name="allergies"
              value={form.allergies}
              onChange={updateField}
            />

            <TextArea
              label="Chronic conditions"
              name="chronic_conditions"
              value={form.chronic_conditions}
              onChange={updateField}
            />

            <TextArea
              label="Notes"
              name="notes"
              value={form.notes}
              onChange={updateField}
            />
          </Section>

          <div className="page-actions justify-end">
            <button
              type="button"
              onClick={() => {
                window.location.href = `/patients/${patient.id}`;
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
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
      </div>

      <div className="card-body">
        <div className="grid gap-5 sm:grid-cols-2">
          {children}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  value: string | undefined;
  onChange: (name: string, value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={name} className="label">
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        value={value || ""}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        required={required}
        className="input"
      />
    </div>
  );
}

function TextArea({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string | undefined;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <div className="field sm:col-span-2">
      <label htmlFor={name} className="label">
        {label}
      </label>

      <textarea
        id={name}
        name={name}
        value={value || ""}
        onChange={(e) => onChange(name, e.target.value)}
        rows={4}
        className="input"
      />
    </div>
  );
}
