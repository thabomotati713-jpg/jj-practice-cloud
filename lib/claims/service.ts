import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { adminClient, requireProfile } from "../serverAccess";
import {
  CLAIM_ROLES,
  SCHEME_ROUTES,
  emptyClaimConfig,
  localDay,
  validateClaim,
  confirmedRoute,
  cents,
  type ClaimConfig,
  type ClaimSnapshot,
} from "./model";
import { claimPdf } from "./pdf";
type Db = ReturnType<typeof adminClient>;
export class ClaimError extends Error {
  constructor(
    public status: number,
    message: string,
    public existingClaimId?: string,
  ) {
    super(message);
  }
}
export function claimFailure(e: unknown) {
  const status =
    e instanceof ClaimError
      ? e.status
      : e instanceof Error && ["401", "403"].includes(e.message)
        ? Number(e.message)
        : 500;
  return Response.json(
    {
      error:
        status === 500
          ? "The claim request could not be completed. Your saved claim is retained."
          : e instanceof Error
            ? e.message
            : "Request failed",
      ...(e instanceof ClaimError && e.existingClaimId
        ? { existingClaimId: e.existingClaimId }
        : {}),
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function id(value: unknown) {
  if (typeof value !== "string" || !UUID.test(value))
    throw new ClaimError(400, "Choose a valid claim or invoice.");
  return value;
}
export async function claimAccess(req: Request, owner = false) {
  const auth = await requireProfile(req);
  if (
    !auth.profile.practice_id ||
    !(owner ? ["owner", "admin"] : (CLAIM_ROLES as readonly string[])).includes(
      auth.profile.role,
    )
  )
    throw new ClaimError(
      403,
      owner
        ? "Only the practice owner or administrator can configure claims."
        : "Claim access requires an active doctor, billing or practice administrator profile.",
    );
  return { ...auth, practiceId: auth.profile.practice_id as string };
}
export async function claimConfig(
  db: Db,
  practiceId: string,
): Promise<ClaimConfig> {
  const { data, error } = await db
    .from("claim_automation_settings")
    .select("config")
    .eq("practice_id", practiceId)
    .maybeSingle();
  if (error) throw new ClaimError(500, "Claim settings unavailable.");
  return { ...emptyClaimConfig(), ...(data?.config || {}) };
}
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const number = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
export const fingerprint = (s: ClaimSnapshot) =>
  createHash("sha256").update(JSON.stringify(s)).digest("hex");
export function emailReady() {
  return Boolean(
    process.env.RESEND_API_KEY &&
    process.env.RESEND_FROM_EMAIL &&
    !/@resend\.dev(?:>|$)/i.test(process.env.RESEND_FROM_EMAIL),
  );
}
export async function buildClaim(
  db: Db,
  practiceId: string,
  invoiceId: string,
  options: {
    consultationId?: string;
    authorization?: string;
    claimId?: string;
  } = {},
) {
  const { data: invoice, error } = await db
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("practice_id", practiceId)
    .maybeSingle();
  if (error || !invoice)
    throw new ClaimError(404, "Invoice not found in this practice.");
  const [
    { data: patient, error: pe },
    { data: practice },
    { data: settingsRows },
    { data: lines, error: le },
    { data: packet },
    { data: claims },
    config,
  ] = await Promise.all([
    db
      .from("patients")
      .select(
        "id,first_name,middle_name,last_name,date_of_birth,id_number,passport_number,medical_aid_provider,medical_aid_number,medical_aid_plan,medical_aid_dependent_code,medical_aid_main_member",
      )
      .eq("id", invoice.patient_id)
      .eq("practice_id", practiceId)
      .maybeSingle(),
    db
      .from("practices")
      .select("name,email,phone,address,city,province,postal_code,active")
      .eq("id", practiceId)
      .single(),
    db
      .from("practice_settings")
      .select("setting_key,setting_value")
      .eq("practice_id", practiceId)
      .in("setting_key", [
        "practice_name",
        "email",
        "phone",
        "address",
        "city",
        "province",
        "postal_code",
      ]),
    db
      .from("invoice_items")
      .select(
        "id,description,quantity,unit_price,discount,tax,line_total,service_code",
      )
      .eq("invoice_id", invoiceId)
      .order("created_at")
      .order("id")
      .limit(101),
    db
      .from("claim_packets")
      .select("claim_id,snapshot,consultation_id")
      .eq("invoice_id", invoiceId)
      .eq("practice_id", practiceId)
      .maybeSingle(),
    db
      .from("medical_aid_claims")
      .select("id,claim_number,claim_date,status,submission_date")
      .eq("invoice_id", invoiceId)
      .eq("practice_id", practiceId)
      .neq("status", "cancelled")
      .limit(2),
    claimConfig(db, practiceId),
  ]);
  if (pe || !patient || !practice?.active || le)
    throw new ClaimError(
      400,
      "The patient, practice or invoice items could not be loaded.",
    );
  const existing =
    claims?.find((c) => c.id === (packet?.claim_id || options.claimId)) ||
    claims?.[0];
  if ((claims?.length || 0) > 1)
    throw new ClaimError(
      409,
      "Multiple claims already refer to this invoice. Reconcile them before using automated submission.",
      existing?.id,
    );
  const claimId =
    packet?.claim_id || options.claimId || existing?.id || randomUUID();
  if (existing && existing.id !== claimId)
    throw new ClaimError(409, "This invoice already has a claim.", existing.id);
  if (
    existing &&
    !packet &&
    (!["draft", "ready"].includes(existing.status) || existing.submission_date)
  )
    throw new ClaimError(
      409,
      "This claim was already submitted or closed. Automatic resubmission is disabled.",
      existing.id,
    );
  const lower = new Date(invoice.invoice_date + "T00:00:00Z");
  lower.setUTCDate(lower.getUTCDate() - 15);
  const upper = new Date(invoice.invoice_date + "T00:00:00Z");
  upper.setUTCDate(upper.getUTCDate() + 1);
  const { data: consultations, error: ce } = await db
    .from("consultations")
    .select("id,consultation_date,diagnosis_code,provider_id")
    .eq("patient_id", invoice.patient_id)
    .eq("practice_id", practiceId)
    .gte("consultation_date", lower.toISOString())
    .lt("consultation_date", upper.toISOString())
    .order("consultation_date", { ascending: false })
    .limit(40);
  if (ce) throw new ClaimError(500, "Consultations could not be loaded.");
  const matches = (consultations || []).filter(
    (c) => localDay(c.consultation_date) === invoice.invoice_date,
  );
  const selectedId =
    options.consultationId ??
    packet?.consultation_id ??
    (matches.length === 1 ? matches[0].id : "");
  let consultation: {
    id: string;
    consultation_date: string;
    diagnosis_code: string | null;
    provider_id: string | null;
  } | null = null;
  if (selectedId) {
    const { data, error } = await db
      .from("consultations")
      .select("id,consultation_date,diagnosis_code,provider_id")
      .eq("id", id(selectedId))
      .eq("patient_id", invoice.patient_id)
      .eq("practice_id", practiceId)
      .maybeSingle();
    if (error || !data)
      throw new ClaimError(
        400,
        "Choose a consultation belonging to this patient and practice.",
      );
    consultation = data;
  }
  const { data: provider } = consultation?.provider_id
    ? await db
        .from("profiles")
        .select("id,first_name,last_name,display_name")
        .eq("id", consultation.provider_id)
        .eq("practice_id", practiceId)
        .maybeSingle()
    : { data: null };
  const settings = Object.fromEntries(
    (settingsRows || []).map((r) => [r.setting_key, text(r.setting_value)]),
  );
  const providerDetails = config.providers[provider?.id || ""];
  const snapshot: ClaimSnapshot = {
    version: 1,
    claim_id: claimId,
    practice_id: practiceId,
    patient_id: patient.id,
    claim_number:
      existing?.claim_number ||
      `CLM-${localDay().replaceAll("-", "")}-${claimId.slice(0, 8).toUpperCase()}`,
    claim_date: existing?.claim_date || localDay(),
    practice: {
      name: settings.practice_name || practice.name,
      email: settings.email || text(practice.email),
      phone: settings.phone || text(practice.phone),
      address: [
        settings.address || text(practice.address),
        settings.city || text(practice.city),
        settings.province || text(practice.province),
        settings.postal_code || text(practice.postal_code),
      ]
        .filter(Boolean)
        .join(", "),
    },
    patient: {
      name: [patient.first_name, patient.middle_name, patient.last_name]
        .filter(Boolean)
        .join(" "),
      dob: text(patient.date_of_birth),
      identity: text(patient.id_number) || text(patient.passport_number),
    },
    member: {
      scheme: text(patient.medical_aid_provider),
      number: text(patient.medical_aid_number),
      dependent: text(patient.medical_aid_dependent_code),
      main_member: text(patient.medical_aid_main_member),
      plan: text(patient.medical_aid_plan),
    },
    provider: {
      id: provider?.id || "",
      name:
        [provider?.first_name, provider?.last_name].filter(Boolean).join(" ") ||
        text(provider?.display_name),
      pcns: providerDetails?.pcns || "",
      registration: providerDetails?.registration || "",
    },
    consultation: {
      id: consultation?.id || "",
      service_date: consultation
        ? localDay(consultation.consultation_date)
        : "",
      diagnosis_code: text(consultation?.diagnosis_code).toUpperCase(),
    },
    invoice: {
      id: invoice.id,
      number: invoice.invoice_number,
      date: invoice.invoice_date,
      subtotal: number(invoice.subtotal),
      discount: number(invoice.discount),
      tax: number(invoice.tax),
      total: number(invoice.total),
      paid: number(invoice.amount_paid),
      balance: number(invoice.balance),
      status: invoice.status,
      lines: (lines || []).map((l) => ({
        id: l.id,
        description: text(l.description),
        service_code: text(l.service_code),
        quantity: number(l.quantity),
        unit_price: number(l.unit_price),
        discount: number(l.discount),
        tax: number(l.tax),
        total: number(l.line_total),
        diagnosis_code: text(consultation?.diagnosis_code).toUpperCase(),
      })),
    },
    authorization_number:
      options.authorization ?? packet?.snapshot?.authorization_number ?? "",
  };
  const issues = validateClaim(snapshot);
  return {
    snapshot,
    fingerprint: fingerprint(snapshot),
    issues,
    config,
    consultations: consultations || [],
    existingStatus: existing?.status || "draft",
  };
}
export async function prepareClaim(
  db: Db,
  practiceId: string,
  invoiceId: string,
  actor: string | null,
  options: {
    consultationId?: string;
    authorization?: string;
    claimId?: string;
  } = {},
) {
  const built = await buildClaim(db, practiceId, invoiceId, options);
  const { data, error } = await db.rpc("pc_store_claim_packet", {
    p_claim: built.snapshot.claim_id,
    p_invoice: invoiceId,
    p_snapshot: built.snapshot,
    p_fingerprint: built.fingerprint,
    p_issues: built.issues,
    p_actor: actor,
  });
  if (error)
    throw new ClaimError(
      error.code === "23505" ? 409 : 400,
      "Could not prepare this claim. Check that the invoice has no other active claim.",
    );
  return { claimId: data as string, ...built };
}
export async function enqueueClaim(
  db: Db,
  practiceId: string,
  claimId: string,
  expected: string,
  actor: string,
) {
  const { data: existing } = await db
    .from("claim_submissions")
    .select("id")
    .eq("claim_id", claimId)
    .eq("practice_id", practiceId)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data: packet } = await db
    .from("claim_packets")
    .select("snapshot,fingerprint")
    .eq("claim_id", claimId)
    .eq("practice_id", practiceId)
    .maybeSingle();
  if (!packet)
    throw new ClaimError(404, "Prepare a claim before submitting it.");
  const old = packet.snapshot as ClaimSnapshot;
  const fresh = await buildClaim(db, practiceId, old.invoice.id, {
    claimId,
    consultationId: old.consultation.id,
    authorization: old.authorization_number,
  });
  if (
    expected !== packet.fingerprint ||
    fresh.fingerprint !== packet.fingerprint
  )
    throw new ClaimError(
      409,
      "Source details changed. Refresh the claim and review the updated form before approving.",
    );
  if (fresh.issues.length)
    throw new ClaimError(
      400,
      "Complete the missing claim details before submitting.",
    );
  const route = confirmedRoute(fresh.snapshot, fresh.config);
  if (!fresh.config.submission_enabled || !route)
    throw new ClaimError(
      400,
      "The owner must enable submissions and confirm this scheme’s email route in Claim settings.",
    );
  if (!emailReady())
    throw new ClaimError(
      503,
      "A verified email sender must be configured before claims can be submitted.",
    );
  const bytes = await claimPdf(fresh.snapshot);
  const { data, error } = await db.rpc("pc_enqueue_claim", {
    p_claim: claimId,
    p_fingerprint: expected,
    p_actor: actor,
    p_scheme: route.id,
    p_email: route.email,
    p_sender: process.env.RESEND_FROM_EMAIL!,
    p_pdf: Buffer.from(bytes).toString("base64"),
  });
  if (error)
    throw new ClaimError(
      409,
      "The claim or route changed. Refresh the claim before submitting.",
    );
  return data as string;
}
export type Submission = {
  id: string;
  claim_id: string;
  practice_id: string;
  snapshot: ClaimSnapshot;
  fingerprint: string;
  recipient: string;
  scheme_id: string;
  sender: string;
  pdf_base64: string;
  attempts: number;
  state: string;
};
export type EmailTransport = (s: Submission) => Promise<{
  state: "accepted" | "queued" | "failed" | "needs_review";
  messageId?: string;
  error?: string;
}>;
export const deliverClaimEmail: EmailTransport = async (s) => {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `jj-claim/${s.id}`,
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        from: s.sender,
        to: [s.recipient],
        reply_to: s.snapshot.practice.email,
        subject: `Medical aid claim ${s.snapshot.claim_number}`,
        text: `Please assess the attached medical aid claim and itemised invoice.\nClaim reference: ${s.snapshot.claim_number}\nInvoice reference: ${s.snapshot.invoice.number}\nPractice: ${s.snapshot.practice.name}\nFor queries, reply to the practice.`,
        attachments: [
          {
            filename: `Claim-${s.snapshot.claim_number.replace(/[^a-z0-9-]/gi, "")}.pdf`,
            content: s.pdf_base64,
            content_type: "application/pdf",
          },
        ],
        tags: [{ name: "claim_submission_id", value: s.id }],
      }),
    });
    if (response.ok) {
      const result = await response.json().catch(() => null);
      return typeof result?.id === "string"
        ? { state: "accepted", messageId: result.id }
        : {
            state: "needs_review",
            error:
              "Email service response was incomplete. Reconcile delivery before resubmitting.",
          };
    }
    if (response.status === 429)
      return {
        state: "queued",
        error:
          "Email provider rate limit. The approved claim remains queued for a bounded retry.",
      };
    if ([400, 401, 403, 404, 413, 422].includes(response.status))
      return {
        state: "failed",
        error:
          "Email provider rejected the submission request. Check sender verification, service limits and the scheme route.",
      };
    return {
      state: "needs_review",
      error:
        "The email provider returned an uncertain outcome. Reconcile delivery before resubmitting.",
    };
  } catch {
    return {
      state: "needs_review",
      error:
        "Delivery could not be confirmed. Automatic retries stopped to prevent a duplicate claim.",
    };
  }
};
export async function processClaims(
  db: Db,
  practiceId: string | null = null,
  submissionId: string | null = null,
  transport: EmailTransport = deliverClaimEmail,
) {
  if (transport === deliverClaimEmail && !emailReady())
    return { processed: 0, configurationRequired: true };
  const { data, error } = await db.rpc("pc_take_claim_submissions", {
    p_practice: practiceId,
    p_id: submissionId,
    p_limit: 2,
  });
  if (error)
    throw new ClaimError(500, "The submission queue could not be read.");
  let processed = 0;
  for (const s of (data || []) as Submission[]) {
    let result: Awaited<ReturnType<EmailTransport>>;
    try {
      const cfg = await claimConfig(db, s.practice_id),
        route = confirmedRoute(s.snapshot, cfg);
      const fresh = await buildClaim(db, s.practice_id, s.snapshot.invoice.id, {
        claimId: s.claim_id,
        consultationId: s.snapshot.consultation.id,
        authorization: s.snapshot.authorization_number,
      });
      const { data: legacy } = await db
        .from("medical_aid_claims")
        .select("status,submission_date,claimed_amount")
        .eq("id", s.claim_id)
        .eq("practice_id", s.practice_id)
        .single();
      if (
        !cfg.submission_enabled ||
        !route ||
        route.email !== s.recipient ||
        route.id !== s.scheme_id ||
        fresh.fingerprint !== s.fingerprint ||
        fresh.issues.length ||
        !legacy ||
        !["draft", "ready"].includes(legacy.status) ||
        legacy.submission_date ||
        cents(Number(legacy.claimed_amount)) !==
          cents(s.snapshot.invoice.balance)
      )
        result = {
          state: "needs_review",
          error:
            "The source claim, invoice or confirmed scheme route changed after approval. Review before any submission.",
        };
      else result = await transport(s);
    } catch {
      result = {
        state: "needs_review",
        error:
          "Claim source checks could not be completed. No automatic replay will occur.",
      };
    }
    const { error: saveError } = await db.rpc("pc_finish_claim_submission", {
      p_id: s.id,
      p_state: result.state,
      p_message_id: result.messageId || null,
      p_error: result.error || null,
    });
    if (saveError)
      throw new ClaimError(
        500,
        "Delivery status could not be confirmed. Check the claim before taking further action.",
      );
    processed++;
  }
  return { processed, configurationRequired: false };
}
export async function autoPrepareClaims(db: Db) {
  const { data, error } = await db.rpc("pc_claim_auto_candidates", {
    p_limit: 20,
  });
  if (error)
    throw new ClaimError(500, "Automatic claim preparation is unavailable.");
  let prepared = 0,
    failed = 0;
  const deadline = Date.now() + 12000;
  for (const row of data || []) {
    if (Date.now() > deadline) break;
    try {
      await prepareClaim(db, row.practice_id, row.invoice_id, null);
      prepared++;
    } catch {
      failed++;
    }
  }
  return { prepared, failed };
}

// Only the provider's delivery event is stored; its returned body stays private.
export async function refreshClaimDelivery(
  db: Db,
  practiceId: string | null = null,
  submissionId: string | null = null,
) {
  if (!process.env.RESEND_API_KEY) return;
  let query = db
    .from("claim_submissions")
    .select("id,provider_message_id,delivery_checked_at")
    .eq("state", "accepted")
    .not("provider_message_id", "is", null)
    .order("approved_at")
    .limit(2);
  if (practiceId) query = query.eq("practice_id", practiceId);
  if (submissionId) query = query.eq("id", submissionId);
  const { data } = await query;
  for (const row of data || []) {
    if (
      row.delivery_checked_at &&
      Date.now() - Date.parse(row.delivery_checked_at) < 60000
    )
      continue;
    await db
      .from("claim_submissions")
      .update({ delivery_checked_at: new Date().toISOString() })
      .eq("id", row.id);
    try {
      const response = await fetch(
        "https://api.resend.com/emails/" +
          encodeURIComponent(row.provider_message_id),
        {
          headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY },
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        },
      );
      if (!response.ok) continue;
      const result = await response.json();
      if (
        result.id !== row.provider_message_id ||
        !["delivered", "bounced", "failed", "complained"].includes(
          result.last_event,
        )
      )
        continue;
      await db.rpc("pc_claim_delivery_event", {
        p_event: "poll-" + row.id + "-" + result.last_event,
        p_message: row.provider_message_id,
        p_type: "email." + result.last_event,
      });
    } catch {
      /* Keep acceptance separate from unconfirmed delivery. */
    }
  }
}
export async function saveClaimConfig(
  db: Db,
  practiceId: string,
  actor: string,
  body: unknown,
) {
  if (!body || typeof body !== "object")
    throw new ClaimError(400, "Choose valid claim settings.");
  const b = body as Record<string, unknown>;
  if (
    typeof b.auto_prepare !== "boolean" ||
    typeof b.submission_enabled !== "boolean" ||
    !Array.isArray(b.providers) ||
    !Array.isArray(b.routes) ||
    b.providers.length > 100 ||
    b.routes.length > SCHEME_ROUTES.length
  )
    throw new ClaimError(400, "Choose valid automation settings.");
  const { data: doctors } = await db
    .from("profiles")
    .select("id")
    .eq("practice_id", practiceId)
    .in("role", ["owner", "doctor"]);
  const providers: ClaimConfig["providers"] = {};
  for (const raw of b.providers) {
    if (!raw || typeof raw !== "object")
      throw new ClaimError(400, "Choose valid practitioner details.");
    const p = raw as Record<string, unknown>;
    const providerId = id(p.id),
      pcns = text(p.pcns),
      registration = text(p.registration);
    if (
      !doctors?.some((d) => d.id === providerId) ||
      !/^\d{7}$/.test(pcns) ||
      !registration ||
      registration.length > 40
    )
      throw new ClaimError(
        400,
        "Each configured practitioner needs a seven-digit PCNS number and professional registration.",
      );
    providers[providerId] = { pcns, registration };
  }
  const routes: ClaimConfig["routes"] = {};
  if (b.routes.length && b.route_confirmation !== true)
    throw new ClaimError(
      400,
      "Confirm the scheme inboxes and the practice’s authority to send claim information.",
    );
  for (const routeId of b.routes) {
    const r = SCHEME_ROUTES.find((r) => r.id === routeId);
    if (!r) throw new ClaimError(400, "Choose a published scheme route.");
    routes[r.id] = {
      email: r.email,
      confirmed_at: new Date().toISOString(),
      confirmed_by: actor,
    };
  }
  if (
    b.submission_enabled &&
    (!Object.keys(routes).length || !Object.keys(providers).length)
  )
    throw new ClaimError(
      400,
      "Configure at least one practitioner and confirm a scheme route before enabling submissions.",
    );
  const previous = await claimConfig(db, practiceId);
  const config: ClaimConfig = {
    auto_prepare: b.auto_prepare,
    submission_enabled: b.submission_enabled,
    enabled_at: b.auto_prepare
      ? previous.auto_prepare
        ? previous.enabled_at
        : new Date().toISOString()
      : null,
    providers,
    routes,
  };
  const { error } = await db.from("claim_automation_settings").upsert({
    practice_id: practiceId,
    config,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new ClaimError(500, "Claim settings could not be saved.");
  return config;
}
