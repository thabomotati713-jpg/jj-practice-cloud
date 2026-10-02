"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MarketingInsights from "@/components/MarketingInsights";
import MarketingLeadEditor from "@/components/MarketingLeadEditor";
import { supabase } from "@/lib/supabase";

type Channel = {
  id: string;
  provider: string;
  account_name: string;
  profile_url: string | null;
  connection_mode: string;
  status: string;
};

type Campaign = {
  id: string;
  name: string;
  objective: string;
  audience: string | null;
  offer: string | null;
  landing_url: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type MarketingPost = {
  id: string;
  campaign_id: string | null;
  platform: string;
  title: string | null;
  body: string;
  cta: string | null;
  target_url: string | null;
  scheduled_at: string | null;
  status: string;
  published_at: string | null;
  auto_publish: boolean;
  publish_error: string | null;
  created_at: string;
};

type Lead = {
  id: string;
  contact_name: string;
  practice_name: string | null;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  province: string | null;
  source: string;
  status: string;
  created_at: string;
};

type TrackingLink = {
  id: string;
  campaign_id: string | null;
  slug: string;
  label: string;
  destination_url: string;
  clicks: number;
};

const featureLibrary = [
  { title: "Practice reporting", hook: "See practice activity, billing and stock information in a dedicated reporting workspace.", proof: "Reporting supports daily operational review across practice modules." },
  {
    title: "QR reception check-in",
    hook: "Patients scan, check in and join a live reception queue without another clipboard.",
    proof: "Practice-specific QR code, live queue and staff controls.",
  },
  {
    title: "Online consultations",
    hook: "Move from booked appointment to remote consultation without leaving the practice workflow.",
    proof: "Video consultation entry points remain tied to appointment management.",
  },
  {
    title: "Verifiable sick notes",
    hook: "Give employers and patients a document that can be checked instead of merely trusted.",
    proof: "Sick notes can carry QR/barcode verification.",
  },
  {
    title: "Speciality-ready inventory",
    hook: "A GP, optometrist or other practice can start with stock categories that make sense for that speciality.",
    proof: "Speciality-aware catalogue loading with inventory management.",
  },
  {
    title: "Prescription to stock",
    hook: "Prescription records and real stock movement finally speak to each other.",
    proof: "Inventory-linked prescribing and controlled dispensing workflows.",
  },
  {
    title: "Claims + billing",
    hook: "Clinical work, claims, invoices and balances live in one connected workspace.",
    proof: "Medical-aid claims, invoicing and payment tracking.",
  },
  {
    title: "Branded for each practice",
    hook: "One platform can still feel like each client’s own software.",
    proof: "Practice logos, appearance controls and multiple visual themes.",
  },
  {
    title: "Role-based team access",
    hook: "Reception does not need the same controls as a doctor, biller or stock manager.",
    proof: "Role-based access with practice isolation.",
  },
  {
    title: "Appointment follow-up",
    hook: "Give the team a clear place to spot visits that need attention before the diary becomes a problem.",
    proof: "Dedicated appointment follow-up workspace.",
  },
  {
    title: "One connected patient journey",
    hook: "From booking to arrival, consultation, prescription, billing and follow-up, the record stays connected.",
    proof: "Patient, appointment, clinical and operational modules share one practice database.",
  },
];

const platforms = ["facebook", "google_business", "instagram", "linkedin", "whatsapp", "x", "email"];

const platformLabels: Record<string, string> = {
  facebook: "Facebook",
  google_business: "Google Business",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  x: "X",
  email: "Email",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Johannesburg",
  });
}

function buildCopy(platform: string, featureIndex: number, targetUrl: string) {
  const feature = featureLibrary[featureIndex] || featureLibrary[0];
  const url = targetUrl || "https://jj-practice-cloud-m2ts.vercel.app/demo-request";

  if (platform === "linkedin") {
    return `Healthcare practices should not have to stitch together five systems to manage one patient journey.

${feature.hook}

J&J PracticeCloud brings patient records, scheduling, consultations, prescriptions, claims, billing, stock and reception workflows into one connected cloud workspace.

Featured capability: ${feature.title}
${feature.proof}

See the workflow in a live demonstration:
${url}

#PracticeManagement #HealthTech #SouthAfrica #MedicalPractice`;
  }

  if (platform === "instagram") {
    return `Your practice. Connected. ☁️🩺

${feature.hook}

✨ ${feature.title}
✓ Patient records
✓ Appointments
✓ Claims & billing
✓ Prescriptions & stock
✓ QR reception queue
✓ Online consultations

Book a J&J PracticeCloud demo:
${url}

#JJPracticeCloud #HealthTech #PracticeManagement #SouthAfricanHealthcare #MedicalSoftware`;
  }

  if (platform === "whatsapp") {
    return `J&J PracticeCloud brings your practice into one connected workspace.

${feature.hook}

Book a quick demo here:
${url}`;
  }

  if (platform === "x") {
    return `A medical practice should not need five disconnected systems. J&J PracticeCloud connects patient records, appointments, claims, billing, stock, prescriptions and QR reception workflows. See a demo: ${url}`;
  }

  if (platform === "email") {
    return `J&J PracticeCloud helps medical practices manage the patient journey from booking and QR arrival through consultation, prescriptions, claims, billing and follow-up.

One feature worth seeing: ${feature.title}.
${feature.proof}

A live demo can be requested here:
${url}`;
  }

  return `Running a medical practice is already demanding. The software should make the day simpler.

${feature.hook}

J&J PracticeCloud connects:
• Patient records
• Appointments and online consultations
• QR patient arrival and live queue
• Prescriptions and stock
• Medical-aid claims
• Invoices and payment tracking
• Verifiable sick notes
• Staff access and practice branding

Featured capability: ${feature.title}
${feature.proof}

Book a live demo:
${url}`;
}

export default function MarketingPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");

  const [campaignForm, setCampaignForm] = useState({
    name: "",
    objective: "demo_bookings",
    audience: "Independent medical practices and healthcare professionals in South Africa",
    offer: "Live guided demonstration of J&J PracticeCloud",
    landingUrl: "",
    startDate: "",
    endDate: "",
  });

  const [composer, setComposer] = useState({
    campaignId: "",
    platform: "facebook",
    featureIndex: 0,
    title: "J&J PracticeCloud",
    body: "",
    cta: "Book a demo",
    targetUrl: "",
    scheduledAt: "",
    autoPublish: false,
  });

  const [channelForm, setChannelForm] = useState({
    provider: "facebook",
    accountName: "",
    profileUrl: "",
    connectionMode: "share_only",
  });

  const [leadForm, setLeadForm] = useState({
    contactName: "",
    practiceName: "",
    email: "",
    phone: "",
    specialty: "",
    province: "",
    notes: "",
  });

  const [linkForm, setLinkForm] = useState({
    campaignId: "",
    label: "PracticeCloud demo",
    destinationUrl: "",
    slug: "",
  });

  async function accessToken() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      window.location.href = "/login";
      throw new Error("Your session has expired.");
    }
    return data.session.access_token;
  }

  async function request(action: string, payload: Record<string, unknown> = {}) {
    const token = await accessToken();
    const response = await fetch("/api/marketing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        window.location.href = "/login";
      }
      throw new Error(result.error || "Marketing action failed.");
    }

    return result;
  }

  async function load() {
    try {
      setLoading(true);
      setMessage("");
      const token = await accessToken();
      const response = await fetch("/api/marketing", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          window.location.href = "/login";
          return;
        }
        throw new Error(result.error || "Could not load the marketing workspace.");
      }

      setChannels(result.channels || []);
      setCampaigns(result.campaigns || []);
      setPosts(result.posts || []);
      setLeads(result.leads || []);
      setLinks(result.links || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the marketing workspace.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const demoUrl = `${window.location.origin}/demo-request`;

    setCampaignForm((current) => ({
      ...current,
      landingUrl: current.landingUrl || demoUrl,
    }));
    setComposer((current) => ({
      ...current,
      targetUrl: current.targetUrl || demoUrl,
      body: current.body || buildCopy(current.platform, current.featureIndex, demoUrl),
    }));
    setLinkForm((current) => ({
      ...current,
      destinationUrl: current.destinationUrl || demoUrl,
    }));
  }, []);

  const activeCampaigns = campaigns.filter((campaign) =>
    ["active", "scheduled"].includes(campaign.status)
  ).length;
  const queuedPosts = posts.filter((post) =>
    ["ready", "scheduled"].includes(post.status)
  ).length;
  const newLeads = leads.filter((lead) => lead.status === "new").length;
  const totalClicks = links.reduce((sum, link) => sum + Number(link.clicks || 0), 0);

  const upcomingPosts = useMemo(
    () =>
      posts
        .filter((post) => post.status !== "cancelled")
        .slice()
        .sort((a, b) => {
          const aTime = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
          const bTime = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
          return aTime - bTime;
        })
        .slice(0, 10),
    [posts]
  );

  async function publishNow(postId: string) {
    setWorking(postId);
    try {
      const token = await accessToken();
      const response = await fetch("/api/marketing/publish", {method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({postId})});
      const result = await response.json();
      await load();
      if(!response.ok) throw new Error(result.error);
      setMessage("Organic post published successfully.");
    } catch(error) {setMessage((error as Error).message);} finally {setWorking("");}
  }

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    try {
      setWorking("campaign");
      setMessage("");
      await request("create_campaign", campaignForm);
      setCampaignForm((current) => ({ ...current, name: "" }));
      await load();
      setMessage("Campaign created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create campaign.");
    } finally {
      setWorking("");
    }
  }

  async function savePost(event: FormEvent) {
    event.preventDefault();
    try {
      setWorking("post");
      setMessage("");
      await request("create_post", {
        autoPublish: composer.autoPublish,
        campaignId: composer.campaignId || null,
        platform: composer.platform,
        title: composer.title,
        body: composer.body,
        cta: composer.cta,
        targetUrl: composer.targetUrl,
        scheduledAt: composer.scheduledAt
          ? new Date(composer.scheduledAt + ":00+02:00").toISOString()
          : null,
      });
      await load();
      setMessage(composer.scheduledAt ? "Post added to the schedule." : "Post saved and ready to publish.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save post.");
    } finally {
      setWorking("");
    }
  }

  function regenerateCopy(platform = composer.platform, featureIndex = composer.featureIndex) {
    setComposer((current) => ({
      ...current,
      platform,
      featureIndex,
      body: buildCopy(platform, featureIndex, current.targetUrl),
    }));
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setMessage("Post copy copied to the clipboard.");
  }

  function openShare(post: MarketingPost) {
    const url = encodeURIComponent(post.target_url || window.location.origin);
    const text = encodeURIComponent(post.body);
    let destination = "";

    if (post.platform === "facebook") {
      destination = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    } else if (post.platform === "linkedin") {
      destination = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    } else if (post.platform === "whatsapp") {
      destination = `https://wa.me/?text=${text}%0A${url}`;
    } else if (post.platform === "x") {
      destination = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    } else if (post.platform === "email") {
      destination = `mailto:?subject=${encodeURIComponent(post.title || "J&J PracticeCloud")}&body=${text}%0A%0A${url}`;
    } else {
      void copyText(post.body);
      destination = "https://www.instagram.com/";
    }

    window.open(destination, "_blank", "noopener,noreferrer");
  }

  async function markPost(postId: string, status: string) {
    try {
      setWorking(postId);
      await request("update_post_status", { postId, status });
      await load();
      setMessage(status === "published" ? "Post marked as published." : "Post updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update post.");
    } finally {
      setWorking("");
    }
  }

  async function saveChannel(event: FormEvent) {
    event.preventDefault();
    try {
      setWorking("channel");
      await request("save_channel", {
        ...channelForm,
        status: "ready",
      });
      setChannelForm((current) => ({ ...current, accountName: "", profileUrl: "" }));
      await load();
      setMessage("Social channel saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save channel.");
    } finally {
      setWorking("");
    }
  }

  async function addLead(event: FormEvent) {
    event.preventDefault();
    try {
      setWorking("lead");
      await request("add_lead", { ...leadForm, source: "manual" });
      setLeadForm({
        contactName: "",
        practiceName: "",
        email: "",
        phone: "",
        specialty: "",
        province: "",
        notes: "",
      });
      await load();
      setMessage("Lead added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add lead.");
    } finally {
      setWorking("");
    }
  }

  async function updateLead(leadId: string, status: string) {
    try {
      setWorking(leadId);
      await request("update_lead_status", { leadId, status });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update lead.");
    } finally {
      setWorking("");
    }
  }

  async function createLink(event: FormEvent) {
    event.preventDefault();
    try {
      setWorking("link");
      await request("create_link", linkForm);
      setLinkForm((current) => ({ ...current, slug: "" }));
      await load();
      setMessage("Trackable campaign link created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create tracking link.");
    } finally {
      setWorking("");
    }
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07111f]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <img src="/brand/jj-sidebar.png" alt="J&J PracticeCloud" className="h-11 w-11 rounded-xl object-contain" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">J&J PracticeCloud</p>
              <h1 className="text-lg font-bold">Marketing Command Centre</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/demo-request" target="_blank" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/10">
              Open demo funnel ↗
            </Link>
            <Link href="/superuser" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-sky-100">
              Superuser
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-8 px-5 py-8 sm:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-sky-400/15 via-white/[0.05] to-fuchsia-400/10 p-7 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
                Free-first marketing stack
              </span>
              <h2 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
                Turn PracticeCloud features into campaigns, conversations and booked demos.
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                Plan campaigns, compose platform-ready posts, schedule content, track leads and
                use measurable demo links. Organic publishing stays free; paid campaigns remain
                disabled in this application until spending is explicitly approved.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">Automation readiness</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Facebook and Google Business support organic publishing through Windsor.
                Scheduled automation runs daily at 08:00 SAST, one post per run.
                Other posts remain manual. LinkedIn is pending. Server credentials are required.
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-sky-300/20 bg-sky-300/10 px-5 py-4 text-sm text-sky-100">
            {message}
          </div>
        )}

        <MarketingInsights />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Active campaigns", activeCampaigns],
            ["Posts ready / scheduled", queuedPosts],
            ["New leads", newLeads],
            ["Tracked link clicks", totalClicks],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
              <strong className="mt-3 block text-3xl font-black">{loading ? "—" : value}</strong>
            </div>
          ))}
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 lg:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Built-in positioning library</p>
              <h2 className="mt-2 text-2xl font-bold">What makes J&J PracticeCloud stand out</h2>
            </div>
            <span className="text-sm text-slate-400">{featureLibrary.length} campaign-ready angles</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {featureLibrary.map((feature, index) => (
              <button
                key={feature.title}
                type="button"
                onClick={() => {
                  setComposer((current) => ({ ...current, featureIndex: index }));
                  regenerateCopy(composer.platform, index);
                  document.getElementById("composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-left transition hover:-translate-y-0.5 hover:border-sky-300/30 hover:bg-slate-900"
              >
                <span className="text-xs font-black text-sky-300">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-bold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{feature.hook}</p>
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">Campaign planner</p>
            <h2 className="mt-2 text-2xl font-bold">Create a campaign</h2>
            <form className="mt-6 space-y-4" onSubmit={createCampaign}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Campaign name *</span>
                <input
                  required
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  placeholder="October Practice Demo Drive"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Objective</span>
                  <select
                    value={campaignForm.objective}
                    onChange={(e) => setCampaignForm({ ...campaignForm, objective: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  >
                    <option value="demo_bookings">Demo bookings</option>
                    <option value="awareness">Brand awareness</option>
                    <option value="lead_generation">Lead generation</option>
                    <option value="client_referrals">Client referrals</option>
                    <option value="feature_launch">Feature launch</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Offer</span>
                  <input
                    value={campaignForm.offer}
                    onChange={(e) => setCampaignForm({ ...campaignForm, offer: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Audience</span>
                <textarea
                  rows={3}
                  value={campaignForm.audience}
                  onChange={(e) => setCampaignForm({ ...campaignForm, audience: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Landing page</span>
                <input
                  type="url"
                  value={campaignForm.landingUrl}
                  onChange={(e) => setCampaignForm({ ...campaignForm, landingUrl: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Start date</span>
                  <input
                    type="date"
                    value={campaignForm.startDate}
                    onChange={(e) => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">End date</span>
                  <input
                    type="date"
                    value={campaignForm.endDate}
                    onChange={(e) => setCampaignForm({ ...campaignForm, endDate: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  />
                </label>
              </div>
              <button
                disabled={working === "campaign"}
                className="w-full rounded-xl bg-sky-300 px-4 py-3 font-black text-slate-950 disabled:opacity-60"
              >
                {working === "campaign" ? "Creating..." : "Create campaign"}
              </button>
            </form>

            <div className="mt-8 space-y-3">
              {campaigns.slice(0, 8).map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{campaign.name}</h3>
                      <p className="mt-1 text-xs text-slate-400">{campaign.objective.replaceAll("_", " ")}</p>
                    </div>
                    <select
                      value={campaign.status}
                      onChange={async (event) => {
                        await request("update_campaign_status", {
                          campaignId: campaign.id,
                          status: event.target.value,
                        });
                        await load();
                      }}
                      className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold"
                    >
                      {["draft", "scheduled", "active", "paused", "completed"].map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              {!loading && campaigns.length === 0 && <p className="text-sm text-slate-400">No campaigns yet.</p>}
            </div>
          </section>

          <section id="composer" className="scroll-mt-24 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">Content composer</p>
            <h2 className="mt-2 text-2xl font-bold">Create platform-ready posts without paid AI</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              The copy generator uses your actual product capabilities and platform-specific templates, so it costs nothing to run.
            </p>

            <form className="mt-6 space-y-4" onSubmit={savePost}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Platform</span>
                  <select
                    value={composer.platform}
                    onChange={(event) => {
                      const platform = event.target.value;
                      setComposer((current) => ({
                        ...current,
                        platform,
                        autoPublish: false,
                        body: buildCopy(platform, current.featureIndex, current.targetUrl),
                      }));
                    }}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  >
                    {platforms.map((platform) => (
                      <option key={platform} value={platform}>{platformLabels[platform]}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Campaign</span>
                  <select
                    value={composer.campaignId}
                    onChange={(e) => setComposer({ ...composer, campaignId: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  >
                    <option value="">No campaign</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Selling angle</span>
                <select
                  value={composer.featureIndex}
                  onChange={(event) => {
                    const featureIndex = Number(event.target.value);
                    setComposer((current) => ({
                      ...current,
                      featureIndex,
                      body: buildCopy(current.platform, featureIndex, current.targetUrl),
                    }));
                  }}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                >
                  {featureLibrary.map((feature, index) => (
                    <option key={feature.title} value={index}>{feature.title}</option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm font-bold">{featureLibrary[composer.featureIndex]?.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{featureLibrary[composer.featureIndex]?.proof}</p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Post copy</span>
                <textarea
                  rows={12}
                  value={composer.body}
                  onChange={(e) => setComposer({ ...composer, body: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 leading-6"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Target URL</span>
                  <input
                    type="url"
                    value={composer.targetUrl}
                    onChange={(e) => setComposer({ ...composer, targetUrl: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Schedule (SAST)</span>
                  <input
                    type="datetime-local"
                    value={composer.scheduledAt}
                    onChange={(e) => setComposer({ ...composer, scheduledAt: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  />
                </label>
              </div>

              <label className="block text-sm"><input type="checkbox" checked={composer.autoPublish} disabled={!["facebook","google_business"].includes(composer.platform)} onChange={e=>setComposer({...composer,autoPublish:e.target.checked})}/> Automatically publish this organic post on the next daily run after its schedule. Requires server connection.</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => regenerateCopy()}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold hover:bg-white/10"
                >
                  Regenerate free copy
                </button>
                <button
                  type="button"
                  onClick={() => void copyText(composer.body)}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold hover:bg-white/10"
                >
                  Copy
                </button>
                <button
                  disabled={working === "post"}
                  className="rounded-xl bg-fuchsia-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
                >
                  {working === "post" ? "Saving..." : composer.scheduledAt ? "Schedule post" : "Save ready post"}
                </button>
              </div>
            </form>
          </section>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 lg:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Publishing queue</p>
                <h2 className="mt-2 text-2xl font-bold">Upcoming & ready content</h2>
              </div>
              <span className="text-sm text-slate-400">Organic publishing · daily schedule · SAST</span>
            </div>
            <div className="mt-6 space-y-4">
              {upcomingPosts.map((post) => (
                <article key={post.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-300/10 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-sky-200">
                          {platformLabels[post.platform] || post.platform}
                        </span>
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">{post.status}</span>
                      </div>
                      <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {post.body.length > 420 ? post.body.slice(0, 420) + "…" : post.body}
                      </p>
                      <p className="mt-3 text-xs text-slate-500">
                        {post.scheduled_at ? `Scheduled ${formatDate(post.scheduled_at)}` : "Ready whenever you are"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(post.body)}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/10"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => openShare(post)}
                      className="rounded-lg bg-sky-300 px-3 py-2 text-xs font-black text-slate-950"
                    >
                      Open {platformLabels[post.platform] || post.platform}
                    </button>
                    {["ready","scheduled"].includes(post.status) && ["facebook","google_business"].includes(post.platform) && <button type="button" disabled={working===post.id} onClick={()=>void publishNow(post.id)} className="rounded-lg bg-teal-200 px-3 py-2 text-xs font-bold text-slate-950">Publish organic now</button>}
                    {["draft","ready","scheduled"].includes(post.status) && <button type="button" disabled={working===post.id} onClick={()=>void markPost(post.id,"cancelled")} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Cancel</button>}
                    {post.publish_error && <p className="text-xs text-amber-200">{post.publish_error}</p>}
                    {["draft","ready","scheduled"].includes(post.status) && (
                      <button
                        type="button"
                        disabled={working === post.id}
                        onClick={() => void markPost(post.id, "published")}
                        className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-200"
                      >
                        Mark manually published
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {!loading && upcomingPosts.length === 0 && <p className="text-sm text-slate-400">No content in the queue yet.</p>}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Social accounts</p>
            <h2 className="mt-2 text-2xl font-bold">Channel connections</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Save the real pages now. Free share links work immediately. When provider API/OAuth access is added, the same channel records can move to automatic publishing.
            </p>

            <form className="mt-6 space-y-4" onSubmit={saveChannel}>
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-semibold">Platform</span>
                  <select
                    value={channelForm.provider}
                    onChange={(e) => setChannelForm({ ...channelForm, provider: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  >
                    {["facebook", "instagram", "linkedin", "whatsapp", "x", "google_business", "email"].map((provider) => (
                      <option key={provider} value={provider}>{provider.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold">Account / page name *</span>
                  <input
                    required
                    value={channelForm.accountName}
                    onChange={(e) => setChannelForm({ ...channelForm, accountName: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                    placeholder="J&J PracticeCloud"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Public profile URL</span>
                <input
                  type="url"
                  value={channelForm.profileUrl}
                  onChange={(e) => setChannelForm({ ...channelForm, profileUrl: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  placeholder="https://..."
                />
              </label>
              <button
                disabled={working === "channel"}
                className="w-full rounded-xl bg-violet-300 px-4 py-3 font-black text-slate-950 disabled:opacity-60"
              >
                Save channel
              </button>
            </form>

            <div className="mt-6 space-y-3">
              {channels.map((channel) => (
                <div key={channel.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-950/45 p-4">
                  <div>
                    <strong className="capitalize">{channel.provider.replaceAll("_", " ")}</strong>
                    <p className="text-sm text-slate-400">{channel.account_name}</p>
                  </div>
                  <span className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-xs font-bold text-emerald-200">
                    {channel.connection_mode.replaceAll("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 lg:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Lead CRM</p>
                <h2 className="mt-2 text-2xl font-bold">Demo prospects</h2>
              </div>
              <span className="text-sm text-slate-400">Public demo requests arrive here automatically</span>
            </div>

            <form className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={addLead}>
              <input required placeholder="Contact name" value={leadForm.contactName} onChange={(e) => setLeadForm({ ...leadForm, contactName: e.target.value })} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3" />
              <input placeholder="Practice" value={leadForm.practiceName} onChange={(e) => setLeadForm({ ...leadForm, practiceName: e.target.value })} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3" />
              <input type="email" placeholder="Email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3" />
              <input placeholder="Phone" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3" />
              <input placeholder="Speciality" value={leadForm.specialty} onChange={(e) => setLeadForm({ ...leadForm, specialty: e.target.value })} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3" />
              <input placeholder="Province" value={leadForm.province} onChange={(e) => setLeadForm({ ...leadForm, province: e.target.value })} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3" />
              <input placeholder="Notes" value={leadForm.notes} onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3" />
              <button disabled={working === "lead"} className="rounded-xl bg-emerald-300 px-4 py-3 font-black text-slate-950">Add lead</button>
            </form>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Contact</th>
                    <th className="px-3 py-3">Practice</th>
                    <th className="px-3 py-3">Speciality</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3">Created</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {leads.slice(0, 40).map((lead) => (
                    <tr key={lead.id}>
                      <td className="px-3 py-4">
                        <strong>{lead.contact_name}</strong>
                        <div className="mt-1 text-xs text-slate-400">{lead.email || lead.phone || "No contact detail"}</div>
                        <MarketingLeadEditor lead={lead} onSaved={load} />
                      </td>
                      <td className="px-3 py-4">{lead.practice_name || "—"}</td>
                      <td className="px-3 py-4">{lead.specialty || "—"}</td>
                      <td className="px-3 py-4">{lead.source}</td>
                      <td className="px-3 py-4">{formatDate(lead.created_at)}</td>
                      <td className="px-3 py-4">
                        <select
                          disabled={working === lead.id}
                          value={lead.status}
                          onChange={(e) => void updateLead(lead.id, e.target.value)}
                          className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs"
                        >
                          {["new", "contacted", "demo_booked", "trial", "won", "lost"].map((status) => (
                            <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && leads.length === 0 && <p className="py-5 text-sm text-slate-400">No leads yet.</p>}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Free analytics</p>
            <h2 className="mt-2 text-2xl font-bold">Trackable campaign links</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Create a short PracticeCloud link for each campaign and count visits without paying for another link tracker.
            </p>

            <form className="mt-6 space-y-4" onSubmit={createLink}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Campaign</span>
                <select
                  value={linkForm.campaignId}
                  onChange={(e) => setLinkForm({ ...linkForm, campaignId: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
                >
                  <option value="">No campaign</option>
                  {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                </select>
              </label>
              <input
                required
                placeholder="Link label"
                value={linkForm.label}
                onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
              />
              <input
                required
                type="url"
                placeholder="Destination URL"
                value={linkForm.destinationUrl}
                onChange={(e) => setLinkForm({ ...linkForm, destinationUrl: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
              />
              <input
                placeholder="Optional short name, e.g. qr-demo"
                value={linkForm.slug}
                onChange={(e) => setLinkForm({ ...linkForm, slug: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3"
              />
              <button disabled={working === "link"} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950">
                Create tracked link
              </button>
            </form>

            <div className="mt-6 space-y-3">
              {links.slice(0, 12).map((link) => {
                const shortUrl = typeof window !== "undefined" ? `${window.location.origin}/go/${link.slug}` : `/go/${link.slug}`;
                return (
                  <div key={link.id} className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <strong>{link.label}</strong>
                        <p className="mt-1 truncate text-xs text-slate-400">{shortUrl}</p>
                      </div>
                      <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs font-black text-cyan-200">{link.clicks} clicks</span>
                    </div>
                    <button type="button" onClick={() => void copyText(shortUrl)} className="mt-3 text-xs font-bold text-cyan-300 hover:text-cyan-200">
                      Copy link
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="rounded-[2rem] border border-white/10 bg-black/20 p-6 text-sm leading-6 text-slate-400">
          <strong className="text-slate-200">Free-first rule:</strong> organic publishing, the campaign planner,
          demo funnel, CRM, copy templates and link tracking do not require ad spend. Paid advertising is disabled in this application. Automatic posting through official
          social APIs may require provider approval and account permissions.
        </footer>
      </div>
    </main>
  );
}
