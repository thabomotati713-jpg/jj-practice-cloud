import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPayfastEnv, validateItn } from "@/lib/payfast";

export const dynamic = "force-dynamic";

/**
 * POST /api/payfast/notify
 *
 * PayFast ITN (Instant Transaction Notification) webhook. PayFast
 * calls this after a payment attempt; we validate the payload with
 * PayFast's /eng/query/validate endpoint and only then record the
 * payment against the invoice referenced by m_payment_id.
 *
 * Security:
 * - No user auth (PayFast is the caller) but every payload is
 *   verified against PayFast before anything is written.
 * - Idempotent: a payment with the same PayFast reference is never
 *   recorded twice.
 */
export async function POST(request: Request) {
  try {
    const env = getPayfastEnv();

    if (!env) {
      return NextResponse.json(
        { error: "PayFast is not configured." },
        { status: 503 }
      );
    }

    const rawBody = await request.text();

    const isValid = await validateItn(env, rawBody);

    if (!isValid) {
      return NextResponse.json(
        { error: "ITN validation failed." },
        { status: 400 }
      );
    }

    const params = new URLSearchParams(rawBody);

    const paymentStatus = params.get("payment_status") || "";
    const mPaymentId = params.get("m_payment_id") || "";
    const amountGross = Number(params.get("amount_gross") || "0");
    const pfPaymentId = params.get("pf_payment_id") || "";
    const pfReference = `PF-${pfPaymentId || mPaymentId}`;

    if (paymentStatus !== "COMPLETE" || !mPaymentId) {
      // Pending / failed / cancelled payments: acknowledge but do nothing.
      return NextResponse.json({ received: true, recorded: false });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // m_payment_id is the invoice UUID, set by the pay-link API.
    const { data: invoice } = await adminClient
      .from("invoices")
      .select("id, practice_id, patient_id, total, amount_paid, balance")
      .eq("id", mPaymentId)
      .maybeSingle();

    if (!invoice) {
      return NextResponse.json(
        { error: "Unknown payment reference." },
        { status: 404 }
      );
    }

    const typedInvoice = invoice as {
      id: string;
      practice_id: string;
      patient_id: string;
      total: number | null;
      amount_paid: number | null;
      balance: number | null;
    };

    // Idempotency check: skip if this PayFast payment was already recorded.
    const { data: existingPayment } = await adminClient
      .from("payments")
      .select("id")
      .eq("reference", pfReference)
      .maybeSingle();

    if (existingPayment) {
      return NextResponse.json({ received: true, recorded: false });
    }

    const balanceDue = Number(typedInvoice.balance ?? 0);

    if (amountGross + 0.01 < balanceDue) {
      // Underpayment: record what arrived as a partial payment.
      // (Still trusted — PayFast validated the payload.)
    }

    const recordedAmount = Math.min(amountGross, balanceDue) || amountGross;

    const newPaid =
      Number(typedInvoice.amount_paid ?? 0) + recordedAmount;

    const newBalance = Math.max(
      Number(typedInvoice.total ?? 0) - newPaid,
      0
    );

    let newStatus = "unpaid";

    if (newBalance <= 0.01) {
      newStatus = "paid";
    } else if (newPaid > 0) {
      newStatus = "partially_paid";
    }

    const { error: paymentError } = await adminClient
      .from("payments")
      .insert({
        practice_id: typedInvoice.practice_id,
        invoice_id: typedInvoice.id,
        patient_id: typedInvoice.patient_id,
        payment_number: `PAY-${Date.now()}`,
        payment_date: new Date().toISOString(),
        amount: recordedAmount,
        payment_method: "PayFast",
        reference: pfReference,
        notes: "Paid online via PayFast.",
      });

    if (paymentError) {
      console.error("ITN payment insert failed:", paymentError);
      return NextResponse.json(
        { error: "Could not record the payment." },
        { status: 500 }
      );
    }

    await adminClient
      .from("invoices")
      .update({
        amount_paid: newPaid,
        balance: newBalance,
        status: newStatus,
      })
      .eq("id", typedInvoice.id);

    return NextResponse.json({ received: true, recorded: true });
  } catch (error) {
    console.error("PayFast ITN error:", error);
    return NextResponse.json(
      { error: "ITN processing failed." },
      { status: 500 }
    );
  }
}
