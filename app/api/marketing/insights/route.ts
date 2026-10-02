import { requireProfile, accessError } from "@/lib/serverAccess";
import { configured } from "@/lib/marketing/windsor";
import { syncMarketing } from "@/lib/marketing/service";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const { admin } = await requireProfile(request, true);
    const { data, error } = await admin
      .from("marketing_insights")
      .select("*")
      .order("connector");
    if (error) throw error;
    return Response.json(
      {
        snapshots: data || [],
        configured: configured(),
        paidAdvertising: false,
        linkedin: "pending",
        schedule: "Daily at 08:00 SAST; due posts publish on the next run.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return accessError(error);
  }
}
export async function POST(request: Request) {
  let admin;
  try {
    ({ admin } = await requireProfile(request, true));
  } catch (error) {
    return accessError(error);
  }
  try {
    return Response.json({ results: await syncMarketing(admin) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Sync failed." },
      { status: 503 },
    );
  }
}
