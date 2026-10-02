import { NextRequest } from "next/server";
import { adminClient } from "@/lib/serverAccess";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function limited(ip: string) {
  const now = Date.now();
  const current = attempts.get(ip);

  if (!current || current.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  attempts.set(ip, current);
  return current.count > MAX_ATTEMPTS;
}

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);

    if (limited(ip)) {
      return Response.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429 }
      );
    }

    const body = await request.json();

    if (clean(body?.companyWebsite, 300)) {
      return Response.json({ ok: true });
    }

    const contactName = clean(body?.contactName, 160);
    const practiceName = clean(body?.practiceName, 200);
    const email = clean(body?.email, 320);
    const phone = clean(body?.phone, 80);
    const specialty = clean(body?.specialty, 160);
    const province = clean(body?.province, 160);

    if (!contactName || (!email && !phone)) {
      return Response.json(
        { error: "Please provide your name and either an email address or phone number." },
        { status: 400 }
      );
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const admin = adminClient();
    const campaignId = clean(body?.campaignId, 80);
    const validCampaign = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(campaignId)
      ? (await admin.from("marketing_campaigns").select("id").eq("id", campaignId).maybeSingle()).data?.id : null;
    const { error } = await admin.from("marketing_leads").insert({
      contact_name: contactName,
      practice_name: practiceName || null,
      email: email || null,
      phone: phone || null,
      specialty: specialty || null,
      province: province || null,
      source: "website-demo-request",
      campaign_id: validCampaign || null,
      utm_source: clean(body?.utmSource, 100) || null,
      utm_medium: clean(body?.utmMedium, 100) || null,
      utm_campaign: clean(body?.utmCampaign, 160) || null,
      status: "new",
      notes: clean(body?.notes, 1500) || null,
    });

    if (error) {
      console.error("Marketing lead insert failed:", error);
      return Response.json(
        { error: "We could not save your request right now." },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Demo request failed:", error);
    return Response.json({ error: "Unable to submit your request." }, { status: 500 });
  }
}
