"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { fetchMySpecialty } from "../../lib/specialties";
import styles from "./dashboard.module.css";

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
  const [, setEmail] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");
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
    void loadDashboard();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const modules = [
    { title: "Patients", key: "patients", href: "/patients", icon: "people", description: "Records & clinical history", group: "Care" },
    { title: "Appointments", key: "appointments", href: "/appointments", icon: "calendar", description: "Visits & scheduling", group: "Care" },
    { title: "Prescriptions", key: "prescriptions", href: "/prescriptions", icon: "prescription", description: "Medication & treatment", group: "Care" },
    { title: "Sick notes", key: "sick_notes", href: "/sick-notes", icon: "document", description: "Medical leave certificates", group: "Care" },
    { title: "Invoices", key: "invoices", href: "/invoices", icon: "wallet", description: "Billing & payments", group: "Operations" },
    { title: "Medical aid claims", key: "claims", href: "/claims", icon: "shield", description: "Claims & submissions", group: "Operations" },
    { title: "Inventory", key: "inventory", href: "/inventory", icon: "box", description: "Stock & dispensing", group: "Operations" },
    { title: "Staff", key: "staff", href: "/staff", icon: "people", description: "Your practice team", group: "Operations" },
  ] as const;
  const visibleModules = modules.filter(module => `${module.title} ${module.description}`.toLowerCase().includes(moduleSearch.trim().toLowerCase()));
  const money = (value: number) => `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const metrics = [
    { label: "Invoiced this month", value: money(stats.invoicedThisMonth), note: "Invoices dated this month", icon: "document", href: "/invoices" },
    { label: "Payments on this month’s invoices", value: money(stats.collectedThisMonth), note: "Payments recorded against these invoices", icon: "wallet", href: "/invoices" },
    { label: "Outstanding balance", value: money(stats.outstandingTotal), note: "Across all invoices", icon: "clock", href: "/invoices" },
    { label: "Upcoming appointments", value: String(stats.upcomingWeek), note: "Scheduled & confirmed · next 7 days", icon: "calendar", href: "/appointments" },
  ];

  return (
    <div className={styles.shell}>
      <Link className={styles.skip} href="#dashboard-content">Skip to dashboard</Link>
      <aside className={styles.sidebar} aria-label="Practice navigation">
        <Link href="/dashboard" className={styles.brand}>
          <img
            className={styles.brandLogo}
            src="/brand/jj-practice-cloud-leather.svg"
            alt="J&J Practice Cloud"
          />
          <span>PracticeCloud<small>YOUR PRACTICE, CONNECTED</small></span>
        </Link>
        <div className={styles.workspace}>
          <span className={styles.workspaceIcon}><Icon name="shield" /></span>
          <div><strong>{practiceName || "Your practice"}</strong><small>{specialtyLabel}</small></div>
        </div>
        <nav className={styles.nav} aria-label="Main navigation">
          <Link className={styles.activeNav} aria-current="page" href="/dashboard"><Icon name="grid" />Overview</Link>
          {["Care", "Operations"].map(group => <div key={group} className={styles.navGroup}>
            <p>{group === "Care" ? "PATIENT CARE" : "PRACTICE OPERATIONS"}</p>
            {modules.filter(module => module.group === group).map(module => <Link key={module.key} href={module.href}><Icon name={module.icon} />{module.title}</Link>)}
          </div>)}
          <div className={styles.navGroup}><p>WORKSPACE</p>
            <Link href="/ai/no-show"><Icon name="spark" />Appointment follow-up</Link>
            <Link href="/settings"><Icon name="settings" />Settings</Link>
          </div>
        </nav>
        <div className={styles.sidebarFooter}><span>Built for better practice days.</span><small>J & J SOFTWARE DEVELOPERS</small></div>
      </aside>

      <div className={styles.mainColumn}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>Workspace <span>/</span> <strong>Overview</strong></div>
          <div className={styles.topbarActions}>
            <span className={styles.userAvatar} aria-hidden="true">{userName ? userName.charAt(0).toUpperCase() : "J"}</span>
            <span className={styles.userName}>{userName || "Practice workspace"}</span>
            <button type="button" className={styles.signOut} onClick={handleSignOut}>Sign out <Icon name="logout" /></button>
          </div>
        </header>
        <main id="dashboard-content" className={styles.content}>
          <section className={styles.heading} aria-labelledby="dashboard-title">
            <div><p className={styles.eyebrow}>YOUR PRACTICE AT A GLANCE</p><h1 id="dashboard-title">Good day{userName ? `, ${userName}` : ""}<span>.</span></h1><p>A clear view of your practice. More time for your patients.</p></div>
            <Link className={styles.primaryButton} href="/appointments/new"><Icon name="plus" />New appointment</Link>
          </section>

          <section className={styles.welcome} aria-label="Practice overview">
            <div className={styles.welcomeCopy}>
              <span className={styles.welcomeTag}>{specialtyLabel}</span>
              <h2>{practiceName || "Your practice, in one place."}</h2>
              <p>Care, coordination and the details that keep your day moving.</p>
              <Link href="/patients/new">Register a patient <span aria-hidden="true">↗</span></Link>
            </div>
            <div className={styles.welcomeArt} aria-hidden="true"><div className={styles.orbit}></div><div className={styles.orbitInner}></div><div className={styles.cross}>{practiceLogo ? <img src={practiceLogo} alt="" /> : <Icon name="plus" />}</div><span className={styles.artDot}></span></div>
          </section>

          {error && <div className="alert-error" role="alert">{error}</div>}
          <section className={styles.metrics} aria-label="Practice statistics" aria-busy={loading}>
            {metrics.map(metric => <Link key={metric.label} href={metric.href} className={styles.metric}>
              <div className={styles.metricTop}><span>{metric.label}</span><span className={styles.metricIcon}><Icon name={metric.icon} /></span></div>
              <strong>{loading || error ? "—" : metric.value}</strong><p>{metric.note}</p>
            </Link>)}
          </section>

          <div className={styles.lowerGrid}>
            <section className={styles.moduleSection} aria-labelledby="modules-title">
              <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>EVERYTHING WITHIN REACH</p><h2 id="modules-title">Practice modules</h2></div><span className={styles.moduleCount}>8 modules</span></div>
              <label className={styles.search}><Icon name="search" /><span className={styles.srOnly}>Find a practice module</span><input type="search" placeholder="Find a module…" value={moduleSearch} onChange={event => setModuleSearch(event.target.value)} />{moduleSearch && <button type="button" aria-label="Clear module search" onClick={() => setModuleSearch("")}>×</button>}</label>
              <div className={styles.moduleGrid} aria-busy={loading}>
                {visibleModules.map(module => <Link className={styles.moduleCard} key={module.key} href={module.href}>
                  <div className={styles.moduleTop}><span className={styles.moduleIcon}><Icon name={module.icon} /></span><span className={styles.recordCount}>{loading || error ? "—" : counts[module.key]} <small>records</small></span></div>
                  <h3>{module.title}</h3><p>{module.description}</p><span className={styles.moduleArrow} aria-hidden="true">↗</span>
                </Link>)}
              </div>
              {visibleModules.length === 0 && <p className={styles.empty} role="status">No modules match “{moduleSearch}”. Try patients, billing or stock.</p>}
              {loading && <p className={styles.loading} role="status">Loading your practice overview…</p>}
            </section>

            <aside className={styles.rightRail} aria-label="Practice shortcuts">
              <section className={styles.quickPanel}><div className={styles.sectionHeading}><h2>Quick actions</h2><Icon name="spark" /></div>
                {[
                  { label: "Register a patient", detail: "Start a new patient record", href: "/patients/new", icon: "people" },
                  { label: "Book an appointment", detail: "Plan the next visit", href: "/appointments/new", icon: "calendar" },
                  { label: "Prescriptions", detail: "Review medication records", href: "/prescriptions", icon: "prescription" },
                  { label: "Manage stock", detail: "Receive, adjust and dispense", href: "/inventory", icon: "box" },
                ].map(action => <Link key={action.href} href={action.href} className={styles.quickAction}><span className={styles.quickIcon}><Icon name={action.icon} /></span><span><strong>{action.label}</strong><small>{action.detail}</small></span><span aria-hidden="true">›</span></Link>)}
              </section>
              <section className={styles.followup}><span className={styles.followupIcon}><Icon name="spark" /></span><p className={styles.eyebrow}>APPOINTMENT FOLLOW-UP</p><h2>Keep the next visit<br />on track.</h2><p>Review follow-up priorities and give your team a clear place to start.</p><Link href="/ai/no-show">Open follow-up workspace <span aria-hidden="true">↗</span></Link></section>
              <Link href="/settings" className={styles.settingsLink}><Icon name="settings" /><span>Make this workspace yours<small>Practice details & preferences</small></span><span aria-hidden="true">→</span></Link>
            </aside>
          </div>
          <footer className={styles.footer}><strong>J&J PracticeCloud</strong><span>Thoughtfully connected. Focused on care.</span><p>J&amp;J Practice Cloud supports POPIA-minded practice workflows through role-based access, secure HTTPS transport and audit logging on selected sensitive record views. Each practice remains responsible for its own access controls, policies and lawful use of patient information.</p></footer>
        </main>
      </div>
    </div>
  );
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    calendar: "M4 5h16v16H4z M16 3v4 M8 3v4 M4 11h16 M8 15h2 M14 15h2",
    prescription: "M8 3h8v3h4v15H4V6h4z M9 3v5h6V3 M12 12v6 M9 15h6",
    document: "M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h6",
    wallet: "M3 6h17v15H3z M3 6V3h14v3 M15 11h6v5h-6z",
    shield: "M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7z M8 12l3 3 5-6",
    box: "m3 7 9-5 9 5v10l-9 5-9-5z M3 7l9 5 9-5 M12 12v10 M7 4.8l10 5.6",
    clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
    settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
    plus: "M12 5v14 M5 12h14",
    search: "m21 21-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    logout: "M9 3H3v18h6 M9 12h12 M17 8l4 4-4 4",
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.grid} /></svg>;
}
