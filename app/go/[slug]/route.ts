import { NextRequest } from "next/server";
import { adminClient } from "@/lib/serverAccess";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const safeSlug = String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80);

  if (!safeSlug) {
    return Response.redirect(new URL("/", request.url), 302);
  }

  const admin = adminClient();
  const { data: link } = await admin
    .from("marketing_links")
    .select("id, destination_url, campaign_id")
    .eq("slug", safeSlug)
    .maybeSingle();

  if (!link?.destination_url) {
    return Response.redirect(new URL("/", request.url), 302);
  }

  const destination = new URL(link.destination_url);
  if (!["https:", "http:"].includes(destination.protocol)) return Response.redirect(new URL("/", request.url), 302);
  await admin.rpc("marketing_increment_click", { link_id: link.id });
  if (link.campaign_id) destination.searchParams.set("campaign_id", link.campaign_id);
  if (!destination.searchParams.has("utm_campaign")) destination.searchParams.set("utm_campaign", safeSlug);
  if (!destination.searchParams.has("utm_medium")) destination.searchParams.set("utm_medium", "organic");
  return new Response(null, { status: 302, headers: { Location: destination.toString(), "Cache-Control": "no-store" } });
}
