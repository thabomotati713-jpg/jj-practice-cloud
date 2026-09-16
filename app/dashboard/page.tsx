"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fetchMySpecialty } from "../../lib/specialties";
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
  const [specialtyLabel, setSpecialtyLabel] = useState("General Practice");
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
  const [stats, setStats] = useState({
    invoicedThisMonth: 0,
    collectedThisMonth: 0,
    outstandingTotal: 0,
    upcomingWeek: 0,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const { data: userData } =
      await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
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
      window.location.href = "/login";
      return;
    }

    if (!profile.active) {
      await supabase.auth.signOut();

      window.location.href = "/login";
      return;
    }

    const practiceId = profile.practice_id;

    if (!practiceId) {
      await supabase.auth.signOut();

      window.location.href = "/login";
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

      window.location.href = "/login";
      return;
    }

    if (!practice.active) {
      await supabase.auth.signOut();

      window.location.href = "/login";
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

    fetchMySpecialty(supabase, supabase).then((config) =>
      setSpecialtyLabel(config.label)
    );

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

    // Practice analytics: billing performance and
    // short-term appointment load.
    const today = new Date();

    const todayStr = today
      .toLocaleDateString("en-CA");

    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const monthStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    const monthStartStr = monthStart
      .toLocaleDateString("en-CA");

    const [invoicesStats, upcomingAppointments] =
      await Promise.all([
        supabase
          .from("invoices")
          .select(
            "total, amount_paid, balance, invoice_date"
          )
          .eq("practice_id", practiceId),

        supabase
          .from("appointments")
          .select(
            "id",
            { count: "exact", head: true }
          )
          .eq("practice_id", practiceId)
          .gte("appointment_date", todayStr)
          .lte(
            "appointment_date",
            weekEnd.toLocaleDateString("en-CA")
          )
          .in("status", [
            "scheduled",
            "confirmed",
          ]),
      ]);

    if (!invoicesStats.error) {
      const invoiceRows =
        invoicesStats.data || [];

      const invoicedThisMonth =
        invoiceRows
          .filter(
            (invoice) =>
              invoice.invoice_date >=
              monthStartStr
          )
          .reduce(
            (sum, invoice) =>
              sum + (invoice.total || 0),
            0
          );

      const collectedThisMonth =
        invoiceRows
          .filter(
            (invoice) =>
              invoice.invoice_date >=
              monthStartStr
          )
          .reduce(
            (sum, invoice) =>
              sum +
              (invoice.amount_paid || 0),
            0
          );

      const outstandingTotal =
        invoiceRows.reduce(
          (sum, invoice) =>
            sum + (invoice.balance || 0),
          0
        );

      setStats({
        invoicedThisMonth,
        collectedThisMonth,
        outstandingTotal,
        upcomingWeek:
          upcomingAppointments.count || 0,
      });
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/70 backdrop-blur-xl">
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
                <span className="text-sm font-black tracking-tight text-[#1f7c7a]">
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
            className="btn btn-secondary btn-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="sticky top-[73px] z-10 border-b border-white/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-max items-center gap-1 py-2">
            <a
              href="/dashboard"
              className="rounded-xl bg-[#1f7c7a] px-3 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Dashboard
            </a>

            <a
              href="/patients"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#f8fafc] hover:text-[#1f7c7a]"
            >
              Patients
            </a>

            <a
              href="/appointments"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#f8fafc] hover:text-[#1f7c7a]"
            >
              Appointments
            </a>

            <a
              href="/prescriptions"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#f8fafc] hover:text-[#1f7c7a]"
            >
              Prescriptions
            </a>

            <a
              href="/sick-notes"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#f8fafc] hover:text-[#1f7c7a]"
            >
              Sick Notes
            </a>

            <a
              href="/invoices"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#f8fafc] hover:text-[#1f7c7a]"
            >
              Invoices
            </a>

            <a
              href="/claims"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#f8fafc] hover:text-[#1f7c7a]"
            >
              Claims
            </a>

            <a
              href="/inventory"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#f8fafc] hover:text-[#1f7c7a]"
            >
              Inventory
            </a>

            <a
              href="/staff"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#f8fafc] hover:text-[#1f7c7a]"
            >
              Staff
            </a>

            <a
              href="/settings"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#f8fafc] hover:text-[#1f7c7a]"
            >
              Settings
            </a>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="mb-8">
          <div className="card p-6 sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[var(--glass-shadow)]">
                  {practiceLogo ? (
                    <img
                      src={practiceLogo}
                      alt="Practice logo"
                      className="h-full w-full object-contain p-1.5"
                    />
                  ) : (
                    <span className="text-sm font-bold text-[#1f7c7a]">
                      J&J
                    </span>
                  )}
                </div>

                <div>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1f7c7a]">
                      {practiceName || "J&J Practice Medical Centre"}
                    </p>

                    <span className="rounded-full border border-white/80 bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#1f7c7a] backdrop-blur-xl">
                      {specialtyLabel}
                    </span>
                  </div>

                  <h2 className="display-font text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                    Good day{userName ? `, ${userName}` : ""}
                  </h2>

                  <p className="mt-1.5 text-sm leading-6 text-slate-500 sm:text-base">
                    Here is an overview of your practice today.
                  </p>
                </div>
              </div>

              <div className="flex flex-none items-center gap-3 rounded-2xl border border-white/70 bg-white/60 px-5 py-3.5 shadow-[var(--glass-shadow)] backdrop-blur-xl">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#effaf8] text-[11px] font-extrabold tracking-wide text-[#1f7c7a]">
                  REC
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Total records
                  </p>

                  <p className="display-font text-2xl font-extrabold leading-6 text-slate-900">
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
          </div>
        </section>

        {error && (
          <div className="mb-6 alert-error">
            {error}
          </div>
        )}

        <section className="mb-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Invoiced this month",
                chip: "IN",
                chipClass: "bg-[#effaf8] text-[#1f7c7a]",
                value: `R ${stats.invoicedThisMonth.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
                tone: "text-slate-900",
              },
              {
                label: "Collected this month",
                chip: "COL",
                chipClass: "bg-emerald-50 text-emerald-600",
                value: `R ${stats.collectedThisMonth.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
                tone: "text-emerald-600",
              },
              {
                label: "Outstanding balance",
                chip: "OUT",
                chipClass: "bg-amber-50 text-amber-600",
                value: `R ${stats.outstandingTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
                tone:
                  stats.outstandingTotal > 0
                    ? "text-amber-600"
                    : "text-slate-900",
              },
              {
                label: "Appointments next 7 days",
                chip: "APT",
                chipClass: "bg-sky-50 text-sky-600",
                value: String(stats.upcomingWeek),
                tone: "text-slate-900",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="group rounded-2xl border border-white/70 bg-white/70 p-5 shadow-[var(--glass-shadow)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--glass-shadow-hover)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {stat.label}
                  </p>

                  <span
                    className={`flex h-7 w-9 flex-none items-center justify-center rounded-lg text-[10px] font-extrabold tracking-wide ${stat.chipClass}`}
                  >
                    {stat.chip}
                  </span>
                </div>

                <p
                  className={`display-font mt-3 text-xl font-extrabold tracking-tight sm:text-2xl ${stat.tone}`}
                >
                  {loading ? "—" : stat.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl p-12 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#1f7c7a]" />

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
                  icon="PA"
                  onClick={() => {
                    window.location.href = "/patients";
                  }}
                />

                <DashboardCard
                  title="Appointments"
                  count={counts.appointments}
                  description="Scheduled visits"
                  icon="AP"
                  onClick={() => {
                    window.location.href = "/appointments";
                  }}
                />

                <DashboardCard
                  title="Prescriptions"
                  count={counts.prescriptions}
                  description="Prescription records"
                  icon="RX"
                  onClick={() => {
                    window.location.href = "/prescriptions";
                  }}
                />

                <DashboardCard
                  title="Sick Notes"
                  count={counts.sick_notes}
                  description="Medical leave notes"
                  icon="SN"
                  onClick={() => {
                    window.location.href = "/sick-notes";
                  }}
                />

                <DashboardCard
                  title="Invoices"
                  count={counts.invoices}
                  description="Practice billing"
                  icon="IN"
                  onClick={() => {
                    window.location.href = "/invoices";
                  }}
                />

                <DashboardCard
                  title="Medical Aid Claims"
                  count={counts.claims}
                  description="Submitted claims"
                  icon="CL"
                  onClick={() => {
                    window.location.href = "/claims";
                  }}
                />

                <DashboardCard
                  title="Inventory"
                  count={counts.inventory}
                  description="Stock products"
                  icon="ST"
                  onClick={() => {
                    window.location.href = "/inventory";
                  }}
                />

                <DashboardCard
                  title="Staff"
                  count={counts.staff}
                  description="Practice staff"
                  icon="SF"
                  onClick={() => {
                    window.location.href = "/staff";
                  }}
                />
              </div>
            </section>

            <section className="mt-8">
              <div className="card p-5 sm:p-6">
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
                    chip="NP"
                    chipClass="bg-[#effaf8] text-[#1f7c7a]"
                    onClick={() => {
                      window.location.href = "/patients/new";
                    }}
                  />

                  <QuickAction
                    label="New appointment"
                    chip="NA"
                    chipClass="bg-sky-50 text-sky-600"
                    onClick={() => {
                      window.location.href = "/appointments/new";
                    }}
                  />

                  <QuickAction
                    label="Prescriptions"
                    chip="RX"
                    chipClass="bg-emerald-50 text-emerald-600"
                    onClick={() => {
                      window.location.href = "/prescriptions";
                    }}
                  />

                  <QuickAction
                    label="Open inventory"
                    chip="ST"
                    chipClass="bg-amber-50 text-amber-600"
                    onClick={() => {
                      window.location.href = "/inventory";
                    }}
                  />
                </div>
              </div>
            </section>
          </>
        )}

        <footer className="mt-10 border-t border-slate-200/70 pt-5 pb-8">
          <p className="mx-auto max-w-3xl text-center text-[11px] leading-5 text-slate-400">
            J&amp;J Practice Cloud protects personal and health information in
            accordance with South Africa&apos;s Protection of Personal
            Information Act (POPIA, Act 4 of 2013), with administrative and
            technical safeguards aligned to international healthcare privacy
            standards, including HIPAA. Patient records are encrypted in
            transit and at rest, and all record access is logged for audit.
          </p>
        </footer>
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
      className="group relative overflow-hidden rounded-2xl bg-white p-5 text-left border border-white/70 backdrop-blur-xl shadow-[0_1px_2px_rgb(15,31,45,0.04)] hover:shadow-md hover:border-[#7dd1c8] transition-all duration-200"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#effaf8] text-[13px] font-bold text-[#1f7c7a]">
          {icon}
        </div>

        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
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

      <div className="mt-5 flex items-center text-xs font-semibold text-[#1f7c7a] group-hover:opacity-100 opacity-0 transition-opacity duration-200">
        Open {title.toLowerCase()} →
      </div>
    </button>
  );
}

function QuickAction({
  label,
  chip,
  chipClass,
  onClick,
}: {
  label: string;
  chip: string;
  chipClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3.5 text-left shadow-[var(--glass-shadow)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-[#7dd1c8] hover:bg-white/90 hover:shadow-[var(--glass-shadow-hover)]"
    >
      <span
        className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[11px] font-extrabold tracking-wide transition-transform duration-200 group-hover:scale-105 ${chipClass}`}
      >
        {chip}
      </span>

      <span className="flex-1 text-sm font-semibold text-slate-700">
        {label}
      </span>

      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[#1f7c7a] transition-all duration-200 group-hover:bg-[#effaf8] group-hover:translate-x-0.5">
        →
      </span>
    </button>
  );
}
