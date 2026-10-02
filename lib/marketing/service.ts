import "server-only";
import { adminClient } from "@/lib/serverAccess";
import { sources, type Connector, organicAction } from "./config";
import { configured, readSource, publishOrganic } from "./windsor";
type Admin = ReturnType<typeof adminClient>;
export async function syncMarketing(admin: Admin) {
  if (!configured())
    throw new Error(
      "Add WINDSOR_API_KEY to Vercel to enable live sync. Your saved analytics remain available.",
    );
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Johannesburg",
  });
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  const from = start.toISOString().slice(0, 10),
    to = end.toISOString().slice(0, 10);
  return Promise.all(
    (Object.keys(sources) as Connector[]).map(async (connector) => {
      try {
        const rows = await readSource(connector, from, to);
        if (connector === "facebook_leads") {
          const leads = rows
            .filter((r) => r.id)
            .map((r) => ({
              source: "facebook_leads",
              external_id: String(r.id),
              contact_name: String(r.full_name || "Facebook prospect").slice(
                0,
                160,
              ),
              email: r.email ? String(r.email) : null,
              phone: r.phone_number ? String(r.phone_number) : null,
              status: "new",
            }));
          if (leads.length) {
            const { error } = await admin
              .from("marketing_leads")
              .upsert(leads, {
                onConflict: "source,external_id",
                ignoreDuplicates: true,
              });
            if (error) throw error;
          }
        }
        // Lead PII stays in CRM, never in analytics snapshots.
        const savedRows =
          connector === "facebook_leads" ? [{ lead_count: rows.length }] : rows;
        const { error } = await admin
          .from("marketing_insights")
          .upsert({
            connector,
            account_id: sources[connector].account,
            date_from: from,
            date_to: to,
            rows: savedRows,
            fetched_at: new Date().toISOString(),
            error: null,
          });
        if (error) throw error;
        return { connector, ok: true };
      } catch {
        await admin
          .from("marketing_insights")
          .update({
            error: "Latest sync failed. Showing the last successful snapshot.",
          })
          .eq("connector", connector);
        return { connector, ok: false };
      }
    }),
  );
}
export async function publishPost(admin: Admin, id: string, dueOnly = false) {
  if (!configured())
    throw new Error(
      "Publishing needs WINDSOR_API_KEY in the Vercel server environment.",
    );
  const { data: post, error } = await admin
    .from("marketing_posts")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !post) throw new Error("Post not found.");
  organicAction(post.platform, post.body, post.target_url);
  if (!["ready", "scheduled"].includes(post.status))
    throw new Error(
      "This post cannot be published again. Check its current status.",
    );
  if (
    dueOnly &&
    (!post.auto_publish ||
      !post.scheduled_at ||
      Date.parse(post.scheduled_at) > Date.now())
  )
    throw new Error("Post is not due.");
  // Compare-and-set claims a post once across concurrent workers; never retry an ambiguous send.
  const { data: claimed, error: claimError } = await admin
    .from("marketing_posts")
    .update({
      status: "publishing",
      publish_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", post.status)
    .eq("updated_at", post.updated_at)
    .select("id")
    .maybeSingle();
  if (claimError || !claimed)
    throw new Error("Another request has already claimed this post.");
  try {
    const receipt = await publishOrganic(
      post.platform,
      post.body,
      post.target_url,
    );
    const { error: saveError } = await admin
      .from("marketing_posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        publish_receipt: receipt,
        auto_publish: false,
      })
      .eq("id", id)
      .eq("status", "publishing");
    if (saveError) throw saveError;
    return { ok: true };
  } catch {
    await admin
      .from("marketing_posts")
      .update({
        status: "review_required",
        auto_publish: false,
        publish_error:
          "Publication could not be confirmed. Check the provider page before creating another post.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "publishing");
    throw new Error(
      "Publication requires review. Check the provider page; automatic retries are disabled to avoid duplicates.",
    );
  }
}
