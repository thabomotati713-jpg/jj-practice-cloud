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
    .select("id, destination_url, clicks")
    .eq("slug", safeSlug)
    .maybeSingle();

  if (!link?.destination_url) {
    return Response.redirect(new URL("/", request.url), 302);
  }

  void admin
    .from("marketing_links")
    .update({ clicks: Number(link.clicks || 0) + 1 })
    .eq("id", link.id);

  return Response.redirect(link.destination_url, 302);
}
