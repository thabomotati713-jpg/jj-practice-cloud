import {
  claimAccess,
  claimFailure,
  ClaimError,
  id,
} from "@/lib/claims/service";
import { localDay, cents } from "@/lib/claims/model";
export async function POST(request: Request) {
  try {
    const { admin, practiceId, user } = await claimAccess(request);
    const b = await request.json();
    const claimId = id(b.claimId);
    const { data: claim } = await admin
      .from("medical_aid_claims")
      .select("claimed_amount,submission_date,status")
      .eq("id", claimId)
      .eq("practice_id", practiceId)
      .maybeSingle();
    if (!claim) throw new ClaimError(404, "Claim not found.");
    const statuses = [
      "draft",
      "ready",
      "submitted",
      "accepted",
      "partially_paid",
      "rejected",
      "paid",
      "cancelled",
    ];
    if (!statuses.includes(b.status))
      throw new ClaimError(400, "Choose a valid scheme status.");
    const approved = Number(b.approvedAmount),
      rejected = Number(b.rejectedAmount);
    if (
      !Number.isFinite(approved) ||
      !Number.isFinite(rejected) ||
      approved < 0 ||
      rejected < 0 ||
      cents(approved + rejected) > cents(Number(claim.claimed_amount))
    )
      throw new ClaimError(
        400,
        "Approved and rejected amounts must be non-negative and cannot exceed the claim total.",
      );
    const { data: submission } = await admin
      .from("claim_submissions")
      .select("id,state")
      .eq("claim_id", claimId)
      .eq("practice_id", practiceId)
      .maybeSingle();
    const { data: packet } = await admin
      .from("claim_packets")
      .select("claim_id")
      .eq("claim_id", claimId)
      .eq("practice_id", practiceId)
      .maybeSingle();
    const date = (v: unknown) =>
      typeof v === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !Number.isNaN(Date.parse(v + "T00:00:00Z")) &&
      new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v &&
      v <= localDay();
    if (
      (b.responseDate && !date(b.responseDate)) ||
      (b.submissionDate && !date(b.submissionDate))
    )
      throw new ClaimError(400, "Enter valid dates up to today.");
    if (
      typeof b.notes !== "string" ||
      b.notes.length > 4000 ||
      typeof b.rejectionReason !== "string" ||
      b.rejectionReason.length > 2000
    )
      throw new ClaimError(400, "Shorten the claim notes or rejection reason.");
    if (
      ["accepted", "partially_paid", "rejected", "paid"].includes(b.status) &&
      (!b.responseDate || !b.notes.trim())
    )
      throw new ClaimError(
        400,
        "Record the scheme response date and reference in Notes before recording its outcome.",
      );
    if (b.status === "rejected" && !b.rejectionReason.trim())
      throw new ClaimError(400, "Record the scheme’s rejection reason.");
    if (
      packet &&
      ["draft", "ready", "submitted", "cancelled"].includes(b.status) &&
      b.status !== claim.status
    )
      throw new ClaimError(
        400,
        "This submission’s delivery state is managed automatically. Record only the scheme’s actual response here.",
      );
    if (
      !packet &&
      b.status === "submitted" &&
      (!b.submissionDate || !b.notes.trim())
    )
      throw new ClaimError(
        400,
        "For a claim submitted outside this app, record its submission date and external reference in Notes.",
      );
    const { error } = await admin
      .from("medical_aid_claims")
      .update({
        status: b.status,
        approved_amount: approved,
        rejected_amount: rejected,
        submission_date: submission
          ? claim.submission_date
          : b.submissionDate || null,
        response_date: b.responseDate || null,
        rejection_reason: b.rejectionReason.trim() || null,
        notes: b.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId)
      .eq("practice_id", practiceId);
    if (error) throw new ClaimError(500, "The response could not be saved.");
    await admin.from("claim_submission_events").insert({
      id: `response/${crypto.randomUUID()}`,
      submission_id: submission?.id || null,
      practice_id: practiceId,
      event_type: "scheme_response",
      message: `Scheme outcome ${b.status} recorded by ${user.id}.`,
    });
    return Response.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return claimFailure(e);
  }
}
