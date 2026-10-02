import { requireProfile, accessError } from "@/lib/serverAccess";
import { validFuture } from "@/lib/marketing/config";
export async function POST(request: Request) {
  let admin;
  try {
    ({ admin } = await requireProfile(request, true));
  } catch (error) {
    return accessError(error);
  }
  try {
    const body = await request.json();
    if (typeof body.leadId !== "string") throw new Error("Select a lead.");
    const { data: existing, error: readError } = await admin
      .from("marketing_leads")
      .select("follow_up_at,demo_at,status")
      .eq("id", body.leadId)
      .single();
    if (readError || !existing) throw new Error("Lead not found.");
    const validate = (value: unknown, previous: string | null) =>
      typeof value === "string" &&
      previous &&
      Date.parse(value) === Date.parse(previous)
        ? previous
        : validFuture(value || null);
    const follow = validate(body.followUpAt, existing.follow_up_at),
      demo = validate(body.demoAt, existing.demo_at);
    let url = null;
    if (body.demoUrl) {
      const parsed = new URL(body.demoUrl);
      if (parsed.protocol !== "https:")
        throw new Error("Meeting links must use HTTPS.");
      url = parsed.toString();
    }
    const patch: Record<string, unknown> = {
      notes: String(body.notes || "").slice(0, 4000),
      follow_up_at: follow,
      demo_at: demo,
      demo_url: url,
      updated_at: new Date().toISOString(),
    };
    if (!demo && existing.status === "demo_booked") patch.status = "contacted";
    if (demo) {
      if (new Date(demo).getUTCMinutes() % 30 !== 0)
        throw new Error("Use a 30-minute demo slot.");
      patch.status = "demo_booked";
    }
    const { data, error } = await admin
      .from("marketing_leads")
      .update(patch)
      .eq("id", body.leadId)
      .select("*")
      .single();
    if (error)
      throw new Error(
        error.code === "23505"
          ? "That demo slot is already booked."
          : "Could not save the lead.",
      );
    return Response.json({ lead: data });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }
}
