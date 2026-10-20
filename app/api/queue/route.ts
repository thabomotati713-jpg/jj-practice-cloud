import { NextResponse } from "next/server";
import { accessError, requireProfile } from "../../../lib/serverAccess";

const QUEUE_ROLES = new Set(["owner", "doctor", "reception"]);

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireProfile(request);

    if (!profile.practice_id || !QUEUE_ROLES.has(profile.role)) {
      return NextResponse.json(
        { error: "Clinical or reception access is required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = String(body.action || "");
    const entryId = String(body.entryId || "");

    if (action === "call-next") {
      const { data: nextId, error } = await admin.rpc("pc_queue_call_next", { p_practice_id: profile.practice_id });
      if (error) throw error;
      if (!nextId) return NextResponse.json({ error: "There are no waiting patients today." }, { status: 404 });
      return NextResponse.json({ success: true, entryId: nextId });
    }

    if (!entryId) {
      return NextResponse.json({ error: "Queue entry is required." }, { status: 400 });
    }

    const { data: entry, error: entryError } = await admin
      .from("patient_queue_entries")
      .select("id, status")
      .eq("id", entryId)
      .eq("practice_id", profile.practice_id)
      .maybeSingle();

    if (entryError) throw entryError;

    if (!entry) {
      return NextResponse.json({ error: "Queue entry not found." }, { status: 404 });
    }

    const now = new Date().toISOString();

    const updates: Record<string, string | null> = {
      updated_at: now,
    };

    switch (action) {
      case "call":
        updates.status = "called";
        updates.called_at = now;
        break;
      case "start":
        updates.status = "in_consultation";
        updates.started_at = now;
        if (!entry.status || entry.status === "waiting") {
          updates.called_at = now;
        }
        break;
      case "complete":
        updates.status = "completed";
        updates.completed_at = now;
        break;
      case "send-back":
        updates.status = "waiting";
        updates.queue_order_at = now;
        updates.called_at = null;
        updates.started_at = null;
        break;
      case "cancel":
        updates.status = "cancelled";
        updates.completed_at = now;
        break;
      default:
        return NextResponse.json({ error: "Unknown queue action." }, { status: 400 });
    }

    const { data: updated, error: updateError } = await admin
      .from("patient_queue_entries")
      .update(updates)
      .eq("id", entryId)
      .eq("practice_id", profile.practice_id)
      .eq("status", entry.status)
      .select("id")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) return NextResponse.json({ error: "This queue entry changed. Refresh and try again." }, { status: 409 });

    return NextResponse.json({ success: true });
  } catch (error) {
    return accessError(error);
  }
}
