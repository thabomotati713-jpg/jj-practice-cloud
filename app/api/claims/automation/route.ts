import {
  claimAccess,
  claimFailure,
  ClaimError,
  id,
  prepareClaim,
  claimConfig,
  buildClaim,
  enqueueClaim,
  processClaims,
  emailReady,
  refreshClaimDelivery,
} from "@/lib/claims/service";
import { confirmedRoute, deliveryLabel } from "@/lib/claims/model";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const json = (v: unknown) =>
  Response.json(v, { headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  try {
    const { admin, practiceId } = await claimAccess(request),
      url = new URL(request.url);
    if (url.searchParams.get("claim_id")) {
      const claimId = id(url.searchParams.get("claim_id"));
      const { data: claim } = await admin
        .from("medical_aid_claims")
        .select("id,invoice_id,status")
        .eq("id", claimId)
        .eq("practice_id", practiceId)
        .maybeSingle();
      if (!claim) throw new ClaimError(404, "Claim not found.");
      const { data: delivery } = await admin
        .from("claim_submissions")
        .select("id")
        .eq("claim_id", claimId)
        .eq("practice_id", practiceId)
        .maybeSingle();
      if (delivery) await refreshClaimDelivery(admin, practiceId, delivery.id);
      const [{ data: packet }, { data: submission }, config] =
        await Promise.all([
          admin
            .from("claim_packets")
            .select("*")
            .eq("claim_id", claimId)
            .eq("practice_id", practiceId)
            .maybeSingle(),
          admin
            .from("claim_submissions")
            .select(
              "id,state,recipient,approved_at,attempts,last_error,provider_message_id,updated_at",
            )
            .eq("claim_id", claimId)
            .eq("practice_id", practiceId)
            .maybeSingle(),
          claimConfig(admin, practiceId),
        ]);
      const { data: events } = submission
        ? await admin
            .from("claim_submission_events")
            .select("id,event_type,message,created_at")
            .eq("submission_id", submission.id)
            .eq("practice_id", practiceId)
            .order("created_at", { ascending: false })
            .limit(30)
        : { data: [] };
      const route = packet ? confirmedRoute(packet.snapshot, config) : null;
      return json({
        claim,
        packet,
        submission: submission
          ? { ...submission, label: deliveryLabel[submission.state] }
          : null,
        events,
        route: route
          ? { id: route.id, name: route.name, email: route.email }
          : null,
        submissionEnabled: config.submission_enabled,
        emailConfigured: emailReady(),
      });
    }
    if (url.searchParams.get("invoice_id")) {
      const built = await buildClaim(
        admin,
        practiceId,
        id(url.searchParams.get("invoice_id")),
      );
      return json({
        snapshot: built.snapshot,
        issues: built.issues,
        consultations: built.consultations,
      });
    }
    const q = (url.searchParams.get("q") || "")
      .slice(0, 80)
      .replace(/[%,()_]/g, "");
    let query = admin
      .from("invoices")
      .select(
        "id,invoice_number,invoice_date,total,balance,patient:patients!inner(first_name,last_name,patient_id,medical_aid_number)",
      )
      .eq("practice_id", practiceId)
      .in("status", ["unpaid", "overdue"])
      .eq("amount_paid", 0)
      .gt("total", 0)
      .order("invoice_date", { ascending: false })
      .limit(25);
    if (q) query = query.ilike("invoice_number", `%${q}%`);
    const { data, error } = await query;
    if (error) throw new ClaimError(500, "Invoices could not be searched.");
    return json({ invoices: data || [] });
  } catch (e) {
    return claimFailure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { admin, practiceId, user } = await claimAccess(request);
    if (Number(request.headers.get("content-length") || 0) > 10000)
      throw new ClaimError(413, "Request too large.");
    const body = await request.json().catch(() => null);
    if (!body || typeof body.action !== "string")
      throw new ClaimError(400, "Choose a claim action.");
    if (body.action === "prepare") {
      if (
        body.authorization !== undefined &&
        (typeof body.authorization !== "string" ||
          body.authorization.length > 100)
      )
        throw new ClaimError(
          400,
          "Keep the authorisation reference within 100 characters.",
        );
      const built = await prepareClaim(
        admin,
        practiceId,
        id(body.invoiceId),
        user.id,
        {
          ...(body.claimId ? { claimId: id(body.claimId) } : {}),
          ...(body.consultationId !== undefined
            ? {
                consultationId: body.consultationId
                  ? id(body.consultationId)
                  : "",
              }
            : {}),
          authorization: body.authorization,
        },
      );
      return json({ claimId: built.claimId, issues: built.issues });
    }
    if (body.action === "approve") {
      if (
        body.reviewed !== true ||
        body.authority !== true ||
        typeof body.fingerprint !== "string" ||
        !/^[a-f0-9]{64}$/.test(body.fingerprint)
      )
        throw new ClaimError(
          400,
          "Review the form, codes, required supporting documents and destination, then confirm submission authority.",
        );
      const submissionId = await enqueueClaim(
        admin,
        practiceId,
        id(body.claimId),
        body.fingerprint,
        user.id,
      );
      // Dispatch within the authorised request. Durable queued work also has a daily backstop.
      await processClaims(admin, practiceId, submissionId);
      return json({ submissionId });
    }
    if (body.action === "process") {
      return json(await processClaims(admin, practiceId));
    }
    if (body.action === "auto_prepare_invoice") {
      const config = await claimConfig(admin, practiceId);
      if (!config.auto_prepare) return json({ skipped: true });
      const { data: invoice } = await admin
        .from("invoices")
        .select("created_at,patient_id,status,amount_paid,total")
        .eq("id", id(body.invoiceId))
        .eq("practice_id", practiceId)
        .maybeSingle();
      if (
        !invoice ||
        !["unpaid", "overdue"].includes(invoice.status) ||
        Number(invoice.amount_paid) !== 0 ||
        Number(invoice.total) <= 0 ||
        !config.enabled_at ||
        invoice.created_at < config.enabled_at
      )
        return json({ skipped: true });
      const { data: patient } = await admin
        .from("patients")
        .select("medical_aid_number")
        .eq("id", invoice.patient_id)
        .eq("practice_id", practiceId)
        .maybeSingle();
      if (!patient?.medical_aid_number) return json({ skipped: true });
      const prepared = await prepareClaim(
        admin,
        practiceId,
        body.invoiceId,
        user.id,
      );
      return json({ claimId: prepared.claimId });
    }
    throw new ClaimError(400, "Unknown claim action.");
  } catch (e) {
    return claimFailure(e);
  }
}
