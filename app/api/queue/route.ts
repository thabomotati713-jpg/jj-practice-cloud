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
      const { data: next, error: nextError } = await admin
        .from("patient_queue_entries")
        .select("id")
        .eq("practice_id", profile.practice_id)
        .eq("status", "waiting")
        .order("queue_order_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextError) {
        throw nextError;
      }

      if (!next) {
        return NextResponse.json(
          { error: "There are no waiting patients." },
          { status: 404 }
        );
      }

      const now = new Date().toISOString();
      const { error: updateError } = await admin
        .from("patient_queue_entries")
        .update({
          status: "called",
          called_at: now,
          updated_at: now,
        })
        .eq("id", next.id)
        .eq("practice_id", profile.practice_id)
        .eq("status", "waiting");

      if (updateError) throw updateError;
      return NextResponse.json({ success: true, entryId: next.id });
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

    const { error: updateError } = await admin
      .from("patient_queue_entries")
      .update(updates)
      .eq("id", entryId)
      .eq("practice_id", profile.practice_id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error) {
    return accessError(error);
  }
}
