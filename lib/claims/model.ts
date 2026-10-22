export const CLAIM_ROLES = ["owner", "admin", "doctor", "billing"] as const;
export const SCHEME_ROUTES = [
  {
    id: "discovery",
    name: "Discovery Health Medical Scheme",
    aliases: [
      "Discovery",
      "Discovery Health",
      "Discovery Health Medical Scheme",
      "DHMS",
    ],
    email: "claims@discovery.co.za",
    source: "https://www.discovery.co.za/medical-aid/how-to-claim",
    checked: "2026-10-22",
  },
  {
    id: "bonitas",
    name: "Bonitas Medical Fund",
    aliases: ["Bonitas", "Bonitas Medical Fund"],
    email: "claims@bonitas.co.za",
    source: "https://www.bonitas.co.za/contact-card/first-time-claim-2/",
    checked: "2026-10-22",
  },
  {
    id: "momentum",
    name: "Momentum Medical Scheme",
    aliases: ["Momentum", "Momentum Medical Scheme", "Momentum Health"],
    email: "claims@momentumhealth.co.za",
    source:
      "https://provider.momentumhealth.co.za/static-assets/siteFiles/Dental%20%20Mouthpart%20abbreviation%20codes%20for%20claims.pdf",
    checked: "2026-10-22",
  },
] as const;
// Exact scheme aliases only. Never infer a scheme from its administrator.
const normalise = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
export function findScheme(name: string) {
  return SCHEME_ROUTES.find((s) =>
    s.aliases.some((a) => normalise(a) === normalise(name)),
  );
}
export type RouteConfirmation = {
  email: string;
  confirmed_at: string;
  confirmed_by: string;
};
export type ProviderDetails = { pcns: string; registration: string };
export type ClaimConfig = {
  auto_prepare: boolean;
  submission_enabled: boolean;
  enabled_at: string | null;
  providers: Record<string, ProviderDetails>;
  routes: Record<string, RouteConfirmation>;
};
export const emptyClaimConfig = (): ClaimConfig => ({
  auto_prepare: false,
  submission_enabled: false,
  enabled_at: null,
  providers: {},
  routes: {},
});
export type ClaimLine = {
  id: string;
  description: string;
  service_code: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
  total: number;
  diagnosis_code: string;
};
export type ClaimSnapshot = {
  version: 1;
  claim_id: string;
  practice_id: string;
  patient_id: string;
  claim_number: string;
  claim_date: string;
  practice: { name: string; email: string; phone: string; address: string };
  patient: { name: string; dob: string; identity: string };
  member: {
    scheme: string;
    number: string;
    dependent: string;
    main_member: string;
    plan: string;
  };
  provider: { id: string; name: string; pcns: string; registration: string };
  consultation: { id: string; service_date: string; diagnosis_code: string };
  invoice: {
    id: string;
    number: string;
    date: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paid: number;
    balance: number;
    status: string;
    lines: ClaimLine[];
  };
  authorization_number: string;
};
export type ClaimIssue = { code: string; message: string };
export const localDay = (value: Date | string = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(
    new Date(value),
  );
export const cents = (v: number) => Math.round((v + Number.EPSILON) * 100);
const validDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v + "T00:00:00Z")) &&
  new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v;
export function validateClaim(
  s: ClaimSnapshot,
  today = localDay(),
): ClaimIssue[] {
  const issues: ClaimIssue[] = [];
  const add = (code: string, message: string) => issues.push({ code, message });
  if (
    !s.patient.name ||
    !s.patient.identity ||
    !validDate(s.patient.dob) ||
    s.patient.dob > today
  )
    add(
      "patient",
      "Complete the patient name, date of birth and ID/passport in the patient record.",
    );
  if (
    !s.member.scheme ||
    !s.member.number ||
    !s.member.dependent ||
    !s.member.main_member
  )
    add(
      "membership",
      "Complete the scheme, membership number, dependent code and main member name in the patient record.",
    );
  if (
    !s.practice.name ||
    !s.practice.phone ||
    !s.practice.address ||
    !/^\S+@[^\s@]+\.[^\s@]+$/.test(s.practice.email)
  )
    add(
      "practice",
      "Complete the practice name, address, phone and reply email in Settings.",
    );
  if (
    !s.provider.id ||
    !s.provider.name ||
    !/^\d{7}$/.test(s.provider.pcns) ||
    !s.provider.registration
  )
    add(
      "provider",
      "Select the treating consultation and configure the practitioner’s seven-digit PCNS number and professional registration in Claim settings.",
    );
  if (
    !s.consultation.id ||
    !validDate(s.consultation.service_date) ||
    s.consultation.service_date > today
  )
    add(
      "consultation",
      "Link the completed consultation for the actual service date.",
    );
  if (
    !validDate(s.invoice.date) ||
    s.invoice.date !== s.consultation.service_date
  )
    add(
      "service_date",
      "The invoice date must match this consultation’s service date. Review the source invoice or choose the correct consultation.",
    );
  // Four calendar months is a warning threshold, never an invented eligibility decision.
  const limit = new Date(today + "T00:00:00Z");
  limit.setUTCMonth(limit.getUTCMonth() - 4);
  if (
    validDate(s.consultation.service_date) &&
    s.consultation.service_date < limit.toISOString().slice(0, 10)
  )
    add(
      "late_claim",
      "This service is more than four months old. Check the scheme’s late-claim process and submit through its approved exception channel.",
    );
  if (
    !["unpaid", "overdue"].includes(s.invoice.status) ||
    s.invoice.paid !== 0 ||
    cents(s.invoice.balance) !== cents(s.invoice.total)
  )
    add(
      "payment",
      "Automatic provider submissions currently require an unpaid invoice. Part-paid, paid, draft or cancelled invoices need a separate billing review.",
    );
  if (
    ![
      s.invoice.total,
      s.invoice.subtotal,
      s.invoice.discount,
      s.invoice.tax,
      s.invoice.paid,
      s.invoice.balance,
    ].every((n) => Number.isFinite(n) && n >= 0) ||
    s.invoice.total <= 0
  )
    add(
      "amount",
      "Review the invoice amounts; they must be finite and non-negative, with a positive total.",
    );
  if (!s.invoice.lines.length || s.invoice.lines.length > 100)
    add(
      "lines",
      "Record between 1 and 100 invoice items before preparing a claim.",
    );
  for (const [i, l] of s.invoice.lines.entries()) {
    if (!l.description || !l.service_code || l.service_code.length > 40)
      add(
        "tariff",
        `Item ${i + 1}: enter its actual tariff or NAPPI code on the invoice.`,
      );
    const codes = l.diagnosis_code.split(/[,;\s]+/).filter(Boolean);
    if (
      !codes.length ||
      codes.some((c) => !/^[A-Z][0-9]{2}(?:\.[A-Z0-9]{1,4})?$/.test(c))
    )
      add(
        "diagnosis",
        `Item ${i + 1}: confirm the applicable ICD-10 code in the consultation.`,
      );
    if (
      ![l.quantity, l.unit_price, l.discount, l.tax, l.total].every(
        Number.isFinite,
      ) ||
      l.quantity <= 0 ||
      [l.unit_price, l.discount, l.tax, l.total].some((n) => n < 0) ||
      Math.abs(
        cents(l.quantity * l.unit_price - l.discount + l.tax) - cents(l.total),
      ) > 1
    )
      add(
        "line_total",
        `Item ${i + 1}: review its quantity, price, discount, tax and total on the invoice.`,
      );
  }
  const sum = (key: "total" | "discount" | "tax") =>
    s.invoice.lines.reduce((n, l) => n + cents(l[key]), 0);
  if (
    Math.abs(
      s.invoice.lines.reduce(
        (n, l) => n + cents(l.quantity * l.unit_price),
        0,
      ) - cents(s.invoice.subtotal),
    ) > 1 ||
    Math.abs(sum("total") - cents(s.invoice.total)) > 1 ||
    Math.abs(sum("discount") - cents(s.invoice.discount)) > 1 ||
    Math.abs(sum("tax") - cents(s.invoice.tax)) > 1
  )
    add(
      "totals",
      "Invoice line totals, discounts or tax do not reconcile with the invoice.",
    );
  if (new TextEncoder().encode(JSON.stringify(s)).length > 100000)
    add("size", "This claim is too large. Shorten the invoice descriptions.");
  return issues;
}
export function confirmedRoute(s: ClaimSnapshot, config: ClaimConfig) {
  const route = findScheme(s.member.scheme);
  return route && config.routes[route.id]?.email === route.email ? route : null;
}
export const deliveryLabel: Record<string, string> = {
  queued: "Approved · queued",
  sending: "Sending",
  accepted: "Email service accepted · scheme response pending",
  delivered: "Email delivered · scheme response pending",
  bounced: "Email bounced · action required",
  failed: "Submission failed",
  needs_review: "Delivery uncertain or source changed · review required",
};
export function nextDeliveryState(current: string, event: string) {
  if (
    event === "email.bounced" ||
    event === "email.failed" ||
    event === "email.complained"
  )
    return "bounced";
  if (
    event === "email.delivered" &&
    ["sending", "accepted", "needs_review"].includes(current)
  )
    return "delivered";
  return current;
}
