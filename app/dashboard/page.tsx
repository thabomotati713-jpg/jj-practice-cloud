"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PracticeAccessGuard from "../../components/PracticeAccessGuard";

type Counts = {
  patients: number;
  appointments: number;
  prescriptions: number;
  sick_notes: number;
  invoices: number;
  claims: number;
  staff: number;
  inventory: number;
};

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [practiceLogo, setPracticeLogo] = useState("");
  const [counts, setCounts] = useState<Counts>({
    patients: 0,
    appointments: 0,
    prescriptions: 0,
    sick_notes: 0,
    invoices: 0,
    claims: 0,
    staff: 0,
    inventory: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const { data: userData } =
      await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/";
      return;
    }

    setEmail(userData.user.email || "");

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "practice_id, first_name, last_name, display_name, active"
      )
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();

      setError(
        "Your practice profile could not be found."
      );

      setLoading(false);
      window.location.href = "/";
      return;
    }

    if (!profile.active) {
      await supabase.auth.signOut();

      window.location.href = "/";
      return;
    }

    const practiceId = profile.practice_id;

    if (!practiceId) {
      await supabase.auth.signOut();

      window.location.href = "/";
      return;
    }

    const {
      data: practice,
      error: practiceError,
    } = await supabase
      .from("practices")
      .select("active")
      .eq("id", practiceId)
      .single();

    if (practiceError || !practice) {
      await supabase.auth.signOut();

      window.location.href = "/";
      return;
    }

    if (!practice.active) {
      await supabase.auth.signOut();

      window.location.href = "/";
      return;
    }

    const displayName =
      profile.display_name ||
      [
        profile.first_name,
        profile.last_name,
      ]
        .filter(Boolean)
        .join(" ") ||
      userData.user.email
        ?.split("@")[0] ||
      "there";

    setUserName(displayName);

    const { data: practiceSettings } =
      await supabase
        .from("practice_settings")
        .select(
          "setting_key, setting_value"
        )
        .eq("practice_id", practiceId)
        .in(
          "setting_key",
          [
            "practice_name",
            "logo_url",
          ]
        );

    const practiceNameSetting =
      practiceSettings?.find(
        (setting) =>
          setting.setting_key ===
          "practice_name"
      );

    const practiceLogoSetting =
      practiceSettings?.find(
        (setting) =>
          setting.setting_key ===
          "logo_url"
      );

    setPracticeName(
      practiceNameSetting
        ?.setting_value
        ?.trim() ||
        "J&J PRACTICE MEDICAL CENTRE"
    );

    setPracticeLogo(
      practiceLogoSetting
        ?.setting_value
        ?.trim() || ""
    );

    const [
      patientsResult,
      appointmentsResult,
      prescriptionsResult,
      sickNotesResult,
      invoicesResult,
      claimsResult,
      staffResult,
      inventoryResult,
    ] = await Promise.all([
      supabase
        .from("patients")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "practice_id",
          practiceId
        ),

      supabase
        .from("appointments")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "practice_id",
          practiceId
        ),

      supabase
        .from("prescriptions")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "practice_id",
          practiceId
        ),

      supabase
        .from("sick_notes")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "practice_id",
          practiceId
        ),

      supabase
        .from("invoices")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "practice_id",
          practiceId
        ),

      supabase
        .from("medical_aid_claims")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "practice_id",
          practiceId
        ),

      supabase
        .from("staff")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "practice_id",
          practiceId
        ),

      supabase
        .from("inventory_products")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "practice_id",
          practiceId
        ),
    ]);

    const firstError =
      patientsResult.error ||
      appointmentsResult.error ||
      prescriptionsResult.error ||
      sickNotesResult.error ||
      invoicesResult.error ||
      claimsResult.error ||
      staffResult.error ||
      inventoryResult.error;

    if (firstError) {
      setError(
        firstError.message
      );
    }

    setCounts({
      patients:
        patientsResult.count || 0,

      appointments:
        appointmentsResult.count || 0,

      prescriptions:
        prescriptionsResult.count || 0,

      sick_notes:
        sickNotesResult.count || 0,

      invoices:
        invoicesResult.count || 0,

      claims:
        claimsResult.count || 0,

      staff:
        staffResult.count || 0,

      inventory:
        inventoryResult.count || 0,
    });

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen bg-gradient-to-tr from-slate-50 via-blue-50/30 to-indigo-50/40">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-white/80">
              {practiceLogo ? (
                <img
                  src={practiceLogo}
                  alt="Practice logo"
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <span className="text-sm font-black tracking-tight text-indigo-700">
                  J&J
                </span>
              )}
            </div>

            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                J&J PRACTICE CLOUD
              </h1>

              <p className="text-xs text-slate-500 sm:text-sm">
                Practice Management System
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-white/90 hover:shadow-md"
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="sticky top-[73px] z-10 border-b border-white/70 bg-white/40 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-max items-center gap-1 py-2">
            <a
              href="/dashboard"
              className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Dashboard
            </a>

            <a
              href="/patients"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-indigo-700"
            >
              Patients
            </a>

            <a
              href="/appointments"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-indigo-700"
            >
              Appointments
            </a>

            <a
              href="/prescriptions"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-indigo-700"
            >
              Prescriptions
            </a>

            <a
              href="/sick-notes"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-indigo-700"
            >
              Sick Notes
            </a>

            <a
              href="/invoices"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-indigo-700"
            >
              Invoices
            </a>

            <a
              href="/claims"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-indigo-700"
            >
              Claims
            </a>

            <a
              href="/inventory"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-indigo-700"
            >
              Inventory
            </a>

            <a
              href="/staff"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-indigo-700"
            >
              Staff
            </a>

            <a
              href="/settings"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-indigo-700"
            >
              Settings
            </a>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="mb-8">
          <div className="rounded-3xl border border-white/80 bg-white/40 p-6 shadow-sm backdrop-blur-md sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Practice overview
                </div>

                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/80 bg-white shadow-sm">
                    {practiceLogo ? (
                      <img
                        src={practiceLogo}
                        alt="Practice logo"
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <span className="text-sm font-bold text-indigo-700">
                        J&J
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
                    {practiceName || "J&J PRACTICE MEDICAL CENTRE"}
                  </p>
                </div>

                <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Dashboard
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                  Welcome back{userName ? `, ${userName}` : ""}. Here is an
                  overview of your practice.
                </p>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/60 px-5 py-4 shadow-sm backdrop-blur-md">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Total records
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {loading
                    ? "—"
                    : counts.patients +
                      counts.appointments +
                      counts.prescriptions +
                      counts.sick_notes +
                      counts.invoices +
                      counts.claims +
                      counts.inventory +
                      counts.staff}
                </p>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200/70 bg-red-50/70 p-4 text-sm text-red-700 shadow-sm backdrop-blur-md">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-white/80 bg-white/60 p-12 text-center shadow-sm backdrop-blur-md">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />

            <p className="text-sm font-medium text-slate-500">
              Loading dashboard...
            </p>
          </div>
        ) : (
          <>
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Practice modules
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Manage your practice from one place.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DashboardCard
                  title="Patients"
                  count={counts.patients}
                  description="Patient records"
                  icon="👥"
                  onClick={() => {
                    window.location.href = "/patients";
                  }}
                />

                <DashboardCard
                  title="Appointments"
                  count={counts.appointments}
                  description="Scheduled visits"
                  icon="📅"
                  onClick={() => {
                    window.location.href = "/appointments";
                  }}
                />

                <DashboardCard
                  title="Prescriptions"
                  count={counts.prescriptions}
                  description="Prescription records"
                  icon="💊"
                  onClick={() => {
                    window.location.href = "/prescriptions";
                  }}
                />

                <DashboardCard
                  title="Sick Notes"
                  count={counts.sick_notes}
                  description="Medical leave notes"
                  icon="📄"
                  onClick={() => {
                    window.location.href = "/sick-notes";
                  }}
                />

                <DashboardCard
                  title="Invoices"
                  count={counts.invoices}
                  description="Practice billing"
                  icon="🧾"
                  onClick={() => {
                    window.location.href = "/invoices";
                  }}
                />

                <DashboardCard
                  title="Medical Aid Claims"
                  count={counts.claims}
                  description="Submitted claims"
                  icon="🏥"
                  onClick={() => {
                    window.location.href = "/claims";
                  }}
                />

                <DashboardCard
                  title="Inventory"
                  count={counts.inventory}
                  description="Stock products"
                  icon="📦"
                  onClick={() => {
                    window.location.href = "/inventory";
                  }}
                />

                <DashboardCard
                  title="Staff"
                  count={counts.staff}
                  description="Practice staff"
                  icon="🩺"
                  onClick={() => {
                    window.location.href = "/staff";
                  }}
                />
              </div>
            </section>

            <section className="mt-8">
              <div className="rounded-3xl bg-white/40 p-5 backdrop-blur-md sm:p-6">
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-slate-900">
                    Quick actions
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Jump directly into commonly used areas.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <QuickAction
                    label="New patient"
                    onClick={() => {
                      window.location.href = "/patients/new";
                    }}
                  />

                  <QuickAction
                    label="New appointment"
                    onClick={() => {
                      window.location.href = "/appointments/new";
                    }}
                  />

                  <QuickAction
                    label="Prescriptions"
                    onClick={() => {
                      window.location.href = "/prescriptions";
                    }}
                  />

                  <QuickAction
                    label="Open inventory"
                    onClick={() => {
                      window.location.href = "/inventory";
                    }}
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function DashboardCard({
  title,
  count,
  description,
  icon,
  onClick,
}: {
  title: string;
  count: number;
  description: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-3xl bg-white/60 p-5 text-left backdrop-blur-md border border-white/80 shadow-sm hover:shadow-md hover:bg-white/80 transition-all duration-300"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white/70 text-xl shadow-sm">
          {icon}
        </div>

        <span className="rounded-full bg-slate-50/80 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
          View
        </span>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-500">
          {title}
        </p>

        <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          {count}
        </p>

        <p className="mt-1 text-xs text-slate-400">
          {description}
        </p>
      </div>

      <div className="mt-5 flex items-center text-xs font-semibold text-indigo-600 group-hover:opacity-100 opacity-0 transition-opacity duration-200">
        Open {title.toLowerCase()} →
      </div>
    </button>
  );
}

function QuickAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-between rounded-2xl border border-white/80 bg-white/60 px-4 py-4 text-left shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-white/80 hover:shadow-md"
    >
      <span className="text-sm font-semibold text-slate-700">
        {label}
      </span>

      <span className="text-indigo-600 transition-transform duration-200 group-hover:translate-x-1">
        →
      </span>
    </button>
  );
}
