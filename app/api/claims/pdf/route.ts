import {
  claimAccess,
  claimFailure,
  ClaimError,
  id,
} from "@/lib/claims/service";
import { claimPdf } from "@/lib/claims/pdf";
import type { ClaimSnapshot } from "@/lib/claims/model";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { admin, practiceId, user } = await claimAccess(request),
      claimId = id(new URL(request.url).searchParams.get("claim_id"));
    const { data: packet } = await admin
      .from("claim_packets")
      .select("snapshot")
      .eq("claim_id", claimId)
      .eq("practice_id", practiceId)
      .maybeSingle();
    if (!packet)
      throw new ClaimError(
        404,
        "Prepare this claim before downloading the form.",
      );
    const { data: submission } = await admin
      .from("claim_submissions")
      .select("pdf_base64")
      .eq("claim_id", claimId)
      .eq("practice_id", practiceId)
      .maybeSingle();
    const snapshot = packet.snapshot as ClaimSnapshot;
    const bytes = submission
      ? Buffer.from(submission.pdf_base64, "base64")
      : Buffer.from(await claimPdf(snapshot));
    const { error } = await admin.from("claim_submission_events").insert({
      id: `download/${crypto.randomUUID()}`,
      practice_id: practiceId,
      event_type: "pdf_download",
      message: `Claim PDF ${claimId} downloaded by ${user.id}.`,
    });
    if (error)
      throw new ClaimError(500, "The document access could not be recorded.");
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Claim-${snapshot.claim_number.replace(/[^a-z0-9-]/gi, "")}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (e) {
    return claimFailure(e);
  }
}
