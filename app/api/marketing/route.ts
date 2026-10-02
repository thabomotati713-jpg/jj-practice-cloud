import { NextRequest } from "next/server";
import { accessError, requireProfile } from "@/lib/serverAccess";

const PROVIDERS = new Set([
  "facebook",
  "instagram",
  "linkedin",
  "whatsapp",
  "x",
  "google_business",
  "email",
]);

const PLATFORMS = new Set([
  "facebook",
  "instagram",
  "linkedin",
  "whatsapp",
  "x",
  "email",
]);

const POST_STATUSES = new Set([
  "draft",
  "ready",
  "scheduled",
  "published",
  "cancelled",
]);

const CAMPAIGN_STATUSES = new Set([
  "draft",
  "scheduled",
  "active",
  "completed",
  "paused",
]);

const LEAD_STATUSES = new Set([
  "new",
  "contacted",
  "demo_booked",
  "trial",
  "won",
  "lost",
]);

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function nullable(value: unknown, max = 500) {
  const result = clean(value, max);
  return result || null;
}

function safeHttpUrl(value: unknown) {
  const raw = clean(value, 2048);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireProfile(request, true);

    const [channels, campaigns, posts, leads, links] = await Promise.all([
      admin
        .from("marketing_channels")
        .select("*")
        .order("provider", { ascending: true }),
      admin
        .from("marketing_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("marketing_posts")
        .select("*")
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(250),
      admin
        .from("marketing_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250),
      admin
        .from("marketing_links")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250),
    ]);

    const firstError =
      channels.error ||
      campaigns.error ||
      posts.error ||
      leads.error ||
      links.error;

    if (firstError) {
      return jsonError(firstError.message, 500);
    }

    return Response.json({
      channels: channels.data || [],
      campaigns: campaigns.data || [],
      posts: posts.data || [],
      leads: leads.data || [],
      links: links.data || [],
    });
  } catch (error) {
    return accessError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, user } = await requireProfile(request, true);
    const body = await request.json();
    const action = clean(body?.action, 80);

    if (action === "save_channel") {
      const provider = clean(body.provider, 40);
      const accountName = clean(body.accountName, 120);

      if (!PROVIDERS.has(provider) || !accountName) {
        return jsonError("Choose a supported channel and enter the account name.");
      }

      const profileUrl = safeHttpUrl(body.profileUrl);
      const connectionMode = ["share_only", "api_ready", "external_connector"].includes(
        clean(body.connectionMode, 40)
      )
        ? clean(body.connectionMode, 40)
        : "share_only";
      const status = ["ready", "connected", "paused"].includes(clean(body.status, 40))
        ? clean(body.status, 40)
        : "ready";

      const { data, error } = await admin
        .from("marketing_channels")
        .upsert(
          {
            provider,
            account_name: accountName,
            profile_url: profileUrl,
            connection_mode: connectionMode,
            status,
            notes: nullable(body.notes, 1000),
            created_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "provider,account_name" }
        )
        .select("*")
        .single();

      if (error) return jsonError(error.message, 500);
      return Response.json({ channel: data });
    }

    if (action === "create_campaign") {
      const name = clean(body.name, 160);
      if (!name) return jsonError("Campaign name is required.");

      const landingUrl = safeHttpUrl(body.landingUrl);

      const { data, error } = await admin
        .from("marketing_campaigns")
        .insert({
          name,
          objective: clean(body.objective, 80) || "demo_bookings",
          audience: nullable(body.audience, 1000),
          offer: nullable(body.offer, 1000),
          landing_url: landingUrl,
          status: "draft",
          start_date: nullable(body.startDate, 20),
          end_date: nullable(body.endDate, 20),
          created_by: user.id,
        })
        .select("*")
        .single();

      if (error) return jsonError(error.message, 500);
      return Response.json({ campaign: data });
    }

    if (action === "update_campaign_status") {
      const campaignId = clean(body.campaignId, 80);
      const status = clean(body.status, 40);

      if (!campaignId || !CAMPAIGN_STATUSES.has(status)) {
        return jsonError("Campaign and a valid status are required.");
      }

      const { data, error } = await admin
        .from("marketing_campaigns")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", campaignId)
        .select("*")
        .single();

      if (error) return jsonError(error.message, 500);
      return Response.json({ campaign: data });
    }

    if (action === "create_post") {
      const platform = clean(body.platform, 40);
      const text = clean(body.body, 6000);

      if (!PLATFORMS.has(platform) || !text) {
        return jsonError("Choose a supported platform and add post copy.");
      }

      const scheduledAt = nullable(body.scheduledAt, 80);
      const status = scheduledAt ? "scheduled" : "ready";

      const { data, error } = await admin
        .from("marketing_posts")
        .insert({
          campaign_id: nullable(body.campaignId, 80),
          platform,
          title: nullable(body.title, 200),
          body: text,
          cta: nullable(body.cta, 160),
          target_url: safeHttpUrl(body.targetUrl),
          scheduled_at: scheduledAt,
          status,
          created_by: user.id,
        })
        .select("*")
        .single();

      if (error) return jsonError(error.message, 500);
      return Response.json({ post: data });
    }

    if (action === "update_post_status") {
      const postId = clean(body.postId, 80);
      const status = clean(body.status, 40);

      if (!postId || !POST_STATUSES.has(status)) {
        return jsonError("Post and a valid status are required.");
      }

      const patch: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "published") {
        patch.published_at = new Date().toISOString();
      }

      const { data, error } = await admin
        .from("marketing_posts")
        .update(patch)
        .eq("id", postId)
        .select("*")
        .single();

      if (error) return jsonError(error.message, 500);
      return Response.json({ post: data });
    }

    if (action === "add_lead") {
      const contactName = clean(body.contactName, 160);
      if (!contactName) return jsonError("Lead contact name is required.");

      const { data, error } = await admin
        .from("marketing_leads")
        .insert({
          contact_name: contactName,
          practice_name: nullable(body.practiceName, 200),
          email: nullable(body.email, 320),
          phone: nullable(body.phone, 80),
          specialty: nullable(body.specialty, 160),
          province: nullable(body.province, 160),
          source: clean(body.source, 100) || "manual",
          campaign_id: nullable(body.campaignId, 80),
          status: "new",
          notes: nullable(body.notes, 2000),
        })
        .select("*")
        .single();

      if (error) return jsonError(error.message, 500);
      return Response.json({ lead: data });
    }

    if (action === "update_lead_status") {
      const leadId = clean(body.leadId, 80);
      const status = clean(body.status, 40);

      if (!leadId || !LEAD_STATUSES.has(status)) {
        return jsonError("Lead and a valid status are required.");
      }

      const { data, error } = await admin
        .from("marketing_leads")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", leadId)
        .select("*")
        .single();

      if (error) return jsonError(error.message, 500);
      return Response.json({ lead: data });
    }

    if (action === "create_link") {
      const label = clean(body.label, 160);
      const destinationUrl = safeHttpUrl(body.destinationUrl);
      const requestedSlug = clean(body.slug, 80)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      if (!label || !destinationUrl) {
        return jsonError("Link label and a valid destination URL are required.");
      }

      const slug =
        requestedSlug ||
        crypto.randomUUID().replaceAll("-", "").slice(0, 10);

      const { data, error } = await admin
        .from("marketing_links")
        .insert({
          campaign_id: nullable(body.campaignId, 80),
          slug,
          label,
          destination_url: destinationUrl,
          created_by: user.id,
        })
        .select("*")
        .single();

      if (error) {
        if (error.code === "23505") {
          return jsonError("That tracking link name is already in use.");
        }
        return jsonError(error.message, 500);
      }

      return Response.json({ link: data });
    }

    return jsonError("Unsupported marketing action.");
  } catch (error) {
    return accessError(error);
  }
}
