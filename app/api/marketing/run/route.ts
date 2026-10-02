import { timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/serverAccess";
import { configured } from "@/lib/marketing/windsor";
import { publishPost, syncMarketing } from "@/lib/marketing/service";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (
    !secret ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!configured())
    return Response.json(
      { error: "Windsor server credential is not configured." },
      { status: 503 },
    );
  const admin = adminClient();
  // Interrupted executions remain review-only; no blind retries.
  await admin
    .from("marketing_posts")
    .update({
      status: "review_required",
      auto_publish: false,
      publish_error:
        "Worker interrupted. Verify the provider page before reposting.",
    })
    .eq("status", "publishing")
    .lt("updated_at", new Date(Date.now() - 600000).toISOString());
  const { data, error } = await admin
    .from("marketing_posts")
    .select("id")
    .eq("status", "scheduled")
    .eq("auto_publish", true)
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(1);
  if (error)
    return Response.json({ error: "Queue unavailable." }, { status: 503 });
  const results = [];
  for (const post of data || []) {
    try {
      await publishPost(admin, post.id, true);
      results.push({ id: post.id, ok: true });
    } catch {
      results.push({ id: post.id, ok: false });
    }
  }
  // Keep the free daily worker within its runtime budget.
  const sync = results.length ? null : await syncMarketing(admin);
  return Response.json({ results, sync });
}
