"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";

export default function NewPracticePage() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    practiceName: "",
    practiceCode: "",
    practiceEmail: "",
    practicePhone: "",
    practiceAddress: "",
    practiceCity: "",
    practiceProvince: "",
    practicePostalCode: "",
    adminFirstName: "",
    adminLastName: "",
    adminDisplayName: "",
    adminEmail: "",
    adminPhone: "",
    adminPassword: "",
  });

  useEffect(() => {
    checkSuperuserAccess();
  }, []);

  const checkSuperuserAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();

    if (
      error ||
      !profile ||
      profile.role !== "superuser" ||
      !profile.active
    ) {
      window.location.href = "/dashboard";
      return;
    }

    setCheckingAccess(false);
  };

  const updateField = (
    field: keyof typeof form,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError(
          "Your login session has expired. Please sign in again."
        );
        setLoading(false);
        return;
      }

      const response = await fetch(
        "/api/superuser/create-practice",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(form),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Could not create the practice."
        );
        setLoading(false);
        return;
      }

      setSuccess(
        `Practice "${result.practice.name}" and administrator login were created successfully.`
      );

      setForm({
        practiceName: "",
        practiceCode: "",
        practiceEmail: "",
        practicePhone: "",
        practiceAddress: "",
        practiceCity: "",
        practiceProvince: "",
        practicePostalCode: "",
        adminFirstName: "",
        adminLastName: "",
        adminDisplayName: "",
        adminEmail: "",
        adminPhone: "",
        adminPassword: "",
      });
    } catch (error) {
      console.error(error);

      setError(
        "Could not connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <p className="text-slate-600">
          Checking Superuser access...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-medium text-blue-700">
              J&J PRACTICE CLOUD
            </p>

            <h1 className="text-2xl font-bold text-slate-900">
              Create New Practice
            </h1>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/superuser";
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Superuser
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <form
          onSubmit={handleSubmit}
          className="space-y-8"
        >
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">
                Practice Details
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Enter the details of the medical practice.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Practice Name *
                </label>

                <input
                  required
                  value={form.practiceName}
                  onChange={(e) =>
                    updateField(
                      "practiceName",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                  placeholder="Example Medical Centre"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Practice Code
                </label>

                <input
                  value={form.practiceCode}
                  onChange={(e) =>
                    updateField(
                      "practiceCode",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Practice Email
                </label>

                <input
                  type="email"
                  value={form.practiceEmail}
                  onChange={(e) =>
                    updateField(
                      "practiceEmail",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Practice Phone
                </label>

                <input
                  value={form.practicePhone}
                  onChange={(e) =>
                    updateField(
                      "practicePhone",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  Address
                </label>

                <input
                  value={form.practiceAddress}
                  onChange={(e) =>
                    updateField(
                      "practiceAddress",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  City
                </label>

                <input
                  value={form.practiceCity}
                  onChange={(e) =>
                    updateField(
                      "practiceCity",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Province
                </label>

                <input
                  value={form.practiceProvince}
                  onChange={(e) =>
                    updateField(
                      "practiceProvince",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Postal Code
                </label>

                <input
                  value={form.practicePostalCode}
                  onChange={(e) =>
                    updateField(
                      "practicePostalCode",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">
                First Practice Administrator
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                These details will be used to create the first
                login account for this practice.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  First Name *
                </label>

                <input
                  required
                  value={form.adminFirstName}
                  onChange={(e) =>
                    updateField(
                      "adminFirstName",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Last Name *
                </label>

                <input
                  required
                  value={form.adminLastName}
                  onChange={(e) =>
                    updateField(
                      "adminLastName",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Display Name
                </label>

                <input
                  value={form.adminDisplayName}
                  onChange={(e) =>
                    updateField(
                      "adminDisplayName",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Login Email *
                </label>

                <input
                  required
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) =>
                    updateField(
                      "adminEmail",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Phone
                </label>

                <input
                  value={form.adminPhone}
                  onChange={(e) =>
                    updateField(
                      "adminPhone",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Temporary Password *
                </label>

                <input
                  required
                  type="password"
                  minLength={8}
                  value={form.adminPassword}
                  onChange={(e) =>
                    updateField(
                      "adminPassword",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3"
                  placeholder="Minimum 8 characters"
                />
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/superuser";
              }}
              className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {loading
                ? "Creating Practice..."
                : "Create Practice & Login"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
