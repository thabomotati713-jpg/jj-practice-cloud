import { timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/serverAccess";
import {
  autoPrepareClaims,
  processClaims,
  refreshClaimDelivery,
} from "@/lib/claims/service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET,
    token = request.headers.get("authorization") || "";
  if (!secret)
    return Response.json(
      { error: "Worker authentication is not configured." },
      { status: 503 },
    );
  const expected = `Bearer ${secret}`;
  if (
    Buffer.byteLength(expected) !== Buffer.byteLength(token) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(token))
  )
    return Response.json({ error: "Unauthorised." }, { status: 401 });
  try {
    const db = adminClient();
    const sent = await processClaims(db);
    await refreshClaimDelivery(db);
    const prepared = await autoPrepareClaims(db);
    return Response.json(
      { ...prepared, ...sent },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Claim worker did not complete. Saved claims are retained." },
      { status: 500 },
    );
  }
}
