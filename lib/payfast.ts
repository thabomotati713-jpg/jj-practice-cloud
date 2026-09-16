import { createHash } from "crypto";

/*
 * PayFast payment integration.
 *
 * Flow:
 * 1. GET /api/invoices/[id]/pay-link  -> signed PayFast checkout URL
 *    for the invoice's outstanding balance (staff generates the link).
 * 2. Patient pays on PayFast's hosted page (card, SnapScan, etc.).
 * 3. PayFast POSTs an ITN (Instant Transaction Notification) to
 *    /api/payfast/notify, which validates the payload with PayFast and
 *    records the payment against the invoice.
 *
 * Credentials come from Vercel env:
 *   PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, PAYFAST_PASSPHRASE (optional),
 *   PAYFAST_MODE ("sandbox" | "live", default sandbox).
 */

export type PayfastEnv = {
  merchantId: string;
  merchantKey: string;
  passphrase: string | null;
  processBase: string;
  validateBase: string;
};

export function getPayfastEnv(): PayfastEnv | null {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;

  if (!merchantId || !merchantKey) return null;

  const mode = (process.env.PAYFAST_MODE || "sandbox").toLowerCase();

  const processBase =
    mode === "live"
      ? "https://www.payfast.io/eng/process"
      : "https://sandbox.payfast.io/eng/process";

  const validateBase =
    mode === "live"
      ? "https://www.payfast.io/eng/query/validate"
      : "https://sandbox.payfast.io/eng/query/validate";

  return {
    merchantId,
    merchantKey,
    passphrase: process.env.PAYFAST_PASSPHRASE || null,
    processBase,
    validateBase,
  };
}

/** PayFast signature: MD5 over alphabetically sorted, URL-encoded pairs. */
export function signPayfastFields(
  fields: Record<string, string>,
  passphrase: string | null
): string {
  const keys = Object.keys(fields).sort();

  let signatureString = keys
    .map((key) => `${key}=${encodeURIComponent(fields[key]).replace(/%20/g, "+")}`)
    .join("&");

  if (passphrase) {
    signatureString += `&passphrase=${encodeURIComponent(passphrase).replace(
      /%20/g,
      "+"
    )}`;
  }

  return createHash("md5").update(signatureString).digest("hex");
}

export type PayfastCheckout = {
  url: string;
  fields: Record<string, string>;
};

export function buildCheckoutUrl(
  env: PayfastEnv,
  params: {
    amount: number;
    itemName: string;
    itemDescription: string;
    paymentId: string;
    returnUrl: string;
    cancelUrl: string;
    notifyUrl: string;
    customerEmail?: string | null;
    customerFirstName?: string | null;
    customerLastName?: string | null;
  }
): PayfastCheckout {
  // PayFast wants amounts with exactly two decimals.
  const amount = params.amount.toFixed(2);

  const fields: Record<string, string> = {
    merchant_id: env.merchantId,
    merchant_key: env.merchantKey,
    return_url: params.returnUrl,
    cancel_url: params.cancelUrl,
    notify_url: params.notifyUrl,
    m_payment_id: params.paymentId,
    amount,
    item_name: params.itemName,
  };

  if (params.itemDescription) {
    fields.item_description = params.itemDescription;
  }

  if (params.customerEmail) {
    fields.email_address = params.customerEmail;
  }

  if (params.customerFirstName) {
    fields.name_first = params.customerFirstName;
  }

  if (params.customerLastName) {
    fields.name_last = params.customerLastName;
  }

  const signature = signPayfastFields(fields, env.passphrase);

  const query = new URLSearchParams();

  for (const key of Object.keys(fields).sort()) {
    query.set(key, fields[key]);
  }

  query.set("signature", signature);

  return {
    url: `${env.processBase}?${query.toString()}`,
    fields,
  };
}

/** Validate an ITN payload with PayFast. Returns true when PayFast says VALID. */
export async function validateItn(
  env: PayfastEnv,
  rawBody: string
): Promise<boolean> {
  try {
    const response = await fetch(env.validateBase, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: rawBody,
    });

    const text = (await response.text()).trim();

    return text === "VALID";
  } catch {
    return false;
  }
}
