"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function NewPatientPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    title: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    id_number: "",
    passport_number: "",
    phone: "",
    alternative_phone: "",
    email: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    province: "",
    postal_code: "",
    country: "South Africa",
    occupation: "",
    marital_status: "",
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
    medical_aid_provider: "",
    medical_aid_number: "",
    medical_aid_plan: "",
    medical_aid_dependent_code: "",
    medical_aid_main_member: "",
    blood_type: "",
    allergies: "",
    chronic_conditions: "",
    notes: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      window.location.href = "/";
    }
  };

  const updateField = (
    field: string,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const createPatient = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    const { data: userData } =
      await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/";
      return;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("practice_id")
        .eq("id", userData.user.id)
        .single();

    if (profileError || !profile) {
      setError("Your practice profile could not be found.");
      setLoading(false);
      return;
    }

    const { error: insertError } =
      await supabase
        .from("patients")
        .insert({
          practice_id: profile.practice_id,
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
          notes: form.notes || null,
          status: "active",
        });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setSuccess("Patient created successfully.");

    setTimeout(() => {
      window.location.href = "/patients";
    }, 700);
  };

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500";

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              J&J PRACTICE CLOUD
            </h1>
            <p className="text-sm text-slate-500">
              New Patient
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/patients";
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Back to Patients
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">
            Add New Patient
          </h2>
          <p className="mt-1 text-slate-500">
            Create a new patient record.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        <form
          onSubmit={createPatient}
          className="space-y-6"
        >
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-lg font-semibold text-slate-900">
              Personal Information
            </h3>

            <div className="grid gap-4 md:grid-cols-3">
              <select
                value={form.title}
                onChange={(e) =>
                  updateField("title", e.target.value)
                }
                className={inputClass}
              >
                <option value="">Title</option>
                <option value="Mr">Mr</option>
                <option value="Mrs">Mrs</option>
                <option value="Ms">Ms</option>
                <option value="Dr">Dr</option>
                <option value="Prof">Prof</option>
              </select>

              <input
                required
                placeholder="First Name"
                value={form.first_name}
                onChange={(e) =>
                  updateField("first_name", e.target.value)
                }
                className={inputClass}
              />

              <input
                placeholder="Middle Name"
                value={form.middle_name}
                onChange={(e) =>
                  updateField("middle_name", e.target.value)
                }
                className={inputClass}
              />

              <input
                required
                placeholder="Last Name"
                value={form.last_name}
                onChange={(e) =>
                  updateField("last_name", e.target.value)
                }
                className={inputClass}
              />

              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) =>
                  updateField("date_of_birth", e.target.value)
                }
                className={inputClass}
              />

              <select
                value={form.gender}
                onChange={(e) =>
                  updateField("gender", e.target.value)
                }
                className={inputClass}
              >
                <option value="">Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>

              <input
                placeholder="ID Number"
                value={form.id_number}
                onChange={(e) =>
                  updateField("id_number", e.target.value)
                }
                className={inputClass}
              />

              <input
                placeholder="Passport Number"
                value={form.passport_number}
                onChange={(e) =>
                  updateField("passport_number", e.target.value)
                }
                className={inputClass}
              />

              <input
                placeholder="Occupation"
                value={form.occupation}
                onChange={(e) =>
                  updateField("occupation", e.target.value)
                }
                className={inputClass}
              />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-lg font-semibold text-slate-900">
              Contact Information
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                placeholder="Phone"
                value={form.phone}
                onChange={(e) =>
                  updateField("phone", e.target.value)
                }
                className={inputClass}
              />

              <input
                placeholder="Alternative Phone"
                value={form.alternative_phone}
                onChange={(e) =>
                  updateField("alternative_phone", e.target.value)
                }
                className={inputClass}
              />

              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) =>
                  updateField("email", e.target.value)
                }
                className={inputClass}
              />

              <input
                placeholder="Address Line 1"
                value={form.address_line_1}
                onChange={(e) =>
                  updateField("address_line_1", e.target.value)
                }
                className={inputClass}
              />

              <input
                placeholder="Address Line 2"
                value={form.address_line_2}
                onChange={(e) =>
                  updateField("address_line_2", e.target.value)
                }
                className={inputClass}
              />

              <input
                placeholder="City"
                value={form.city}
                onChange={(e) =>
                  updateField("city", e.target.value)
                }
                className={inputClass}
              />

              <input
                placeholder="Province"
                value={form.province}
                onChange={(e) =>
                  updateField("province", e.target.value)
                }
                className={inputClass}
              />

              <input
                placeholder="Postal Code"
                value={form.postal_code}
                onChange={(e) =>
                  updateField("postal_code", e.target.value)
                }
                className={inputClass}
              />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-lg font-semibold text-slate-900">
              Medical Aid & Emergency Contact
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                placeholder="Medical Aid Provider"
                value={form.medical_aid_provider}
                onChange={(e) =>
                  updateField("medical_aid_provider", e.target.value)
                }
                className={inputClass}
              />

              <input
                placeholder="Medical Aid Number"
                value={form.medical_aid_number}
                onChange={(e) =>
                  updateField("medical_aid_number", e.target.value)
                }
                className={inputClass}
              />

              <input
                placeholder="Medical Aid Plan"
                value={form.medical_aid_plan}
                onChange={(e) =>
                  updateField("medical_aid_plan", e.target.value)
                }
                className={inputClass}
              />

              <input
                placeholder="Dependent Code"
                value={form.medical_aid_dependent_code}
                onChange={(e) =>
                  updateField(
                    "medical_aid_dependent_code",
                    e.target.value
                  )
                }
                className={inputClass}
              />

              <input
                placeholder="Main Member"
                value={form.medical_aid_main_member}
                onChange={(e) =>
                  updateField(
                    "medical_aid_main_member",
                    e.target.value
                  )
                }
                className={inputClass}
              />

              <input
                placeholder="Emergency Contact Name"
                value={form.emergency_contact_name}
                onChange={(e) =>
                  updateField(
                    "emergency_contact_name",
                    e.target.value
                  )
                }
                className={inputClass}
              />

              <input
                placeholder="Emergency Contact Relationship"
                value={form.emergency_contact_relationship}
                onChange={(e) =>
                  updateField(
                    "emergency_contact_relationship",
                    e.target.value
                  )
                }
                className={inputClass}
              />

              <input
                placeholder="Emergency Contact Phone"
                value={form.emergency_contact_phone}
                onChange={(e) =>
                  updateField(
                    "emergency_contact_phone",
                    e.target.value
                  )
                }
                className={inputClass}
              />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-lg font-semibold text-slate-900">
              Medical Information
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                placeholder="Blood Type"
                value={form.blood_type}
                onChange={(e) =>
                  updateField("blood_type", e.target.value)
                }
                className={inputClass}
              />

              <input
                placeholder="Marital Status"
                value={form.marital_status}
                onChange={(e) =>
                  updateField("marital_status", e.target.value)
                }
                className={inputClass}
              />

              <textarea
                placeholder="Allergies"
                value={form.allergies}
                onChange={(e) =>
                  updateField("allergies", e.target.value)
                }
                className={`${inputClass} min-h-24`}
              />

              <textarea
                placeholder="Chronic Conditions"
                value={form.chronic_conditions}
                onChange={(e) =>
                  updateField(
                    "chronic_conditions",
                    e.target.value
                  )
                }
                className={`${inputClass} min-h-24`}
              />

              <textarea
                placeholder="Notes"
                value={form.notes}
                onChange={(e) =>
                  updateField("notes", e.target.value)
                }
                className={`${inputClass} min-h-24 md:col-span-2`}
              />
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/patients";
              }}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Patient"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
