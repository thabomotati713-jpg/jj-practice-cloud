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
      <main className="page-shell">
        <div className="page-inner">
          <p className="page-subtitle">
            Checking Superuser access...
          </p>
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
            <span className="app-brand-name">
              J&J Practice Cloud
            </span>
          </a>

          <div className="page-actions">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/superuser";
              }}
              className="btn btn-secondary btn-sm"
            >
              Back to Superuser
            </button>
          </div>
        </div>
      </header>

      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Create New Practice
            </h1>

            <p className="page-subtitle">
              Register a practice and its first
              administrator login.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Practice Details
                </h2>

                <p className="page-subtitle">
                  Enter the details of the medical
                  practice.
                </p>
              </div>
            </div>

            <div className="card-body">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="field">
                  <label className="label">
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
                    className="input"
                    placeholder="Example Medical Centre"
                  />
                </div>

                <div className="field">
                  <label className="label">
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
                    className="input"
                    placeholder="Optional"
                  />
                </div>

                <div className="field">
                  <label className="label">
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
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label">
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
                    className="input"
                  />
                </div>

                <div className="field md:col-span-2">
                  <label className="label">
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
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label">City</label>

                  <input
                    value={form.practiceCity}
                    onChange={(e) =>
                      updateField(
                        "practiceCity",
                        e.target.value
                      )
                    }
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label">
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
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label">
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
                    className="input"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  First Practice Administrator
                </h2>

                <p className="page-subtitle">
                  These details will be used to create the
                  first login account for this practice.
                </p>
              </div>
            </div>

            <div className="card-body">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="field">
                  <label className="label">
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
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label">
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
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label">
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
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label">
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
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label">Phone</label>

                  <input
                    value={form.adminPhone}
                    onChange={(e) =>
                      updateField(
                        "adminPhone",
                        e.target.value
                      )
                    }
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label">
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
                    className="input"
                    placeholder="Minimum 8 characters"
                  />
                </div>
              </div>
            </div>
          </section>

          {error && (
            <div className="alert-error">{error}</div>
          )}

          {success && (
            <div className="alert-success">{success}</div>
          )}

          <div className="page-actions justify-end">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/superuser";
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
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
