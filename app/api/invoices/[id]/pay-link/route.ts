import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildCheckoutUrl,
  getPayfastEnv,
} from "@/lib/payfast";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoices/[id]/pay-link
 *
 * Staff-only: generates a signed PayFast checkout URL for the
 * invoice's outstanding balance. The link can be copied into WhatsApp
 * or email; PayFast hosts the payment page.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !publishableKey) {
      return NextResponse.json(
        { error: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication is required." },
        { status: 401 }
      );
    }

    const accessToken = authorization.slice("Bearer ".length);

    const authClient = createClient(supabaseUrl, publishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Your login session is invalid." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } =
      await authClient
        .from("profiles")
        .select("practice_id, active")
        .eq("id", user.id)
        .single();

    if (profileError || !profile?.active || !profile.practice_id) {
      return NextResponse.json(
        { error: "You do not have permission to do this." },
        { status: 403 }
      );
    }

    const { data: invoice, error: invoiceError } = await authClient
      .from("invoices")
      .select(
        "id, practice_id, patient_id, invoice_number, total, balance, status"
      )
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found." },
        { status: 404 }
      );
    }

    if (
      (invoice as { practice_id: string }).practice_id !==
      (profile as { practice_id: string }).practice_id
    ) {
      return NextResponse.json(
        { error: "This invoice belongs to another practice." },
        { status: 403 }
      );
    }

    const balance = Number(
      (invoice as { balance: number | null }).balance ?? 0
    );

    if (balance <= 0.01) {
      return NextResponse.json(
        { error: "This invoice is already paid in full." },
        { status: 400 }
      );
    }

    const env = getPayfastEnv();

    if (!env) {
      return NextResponse.json(
        {
          error:
            "Online payments are not configured yet. Add your PayFast account details in Vercel (PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, PAYFAST_PASSPHRASE, PAYFAST_MODE) and redeploy.",
        },
        { status: 503 }
      );
    }

    // Patient details for the PayFast prefilled checkout (best effort).
    const { data: patient } = await authClient
      .from("patients")
      .select("first_name, last_name, email")
      .eq("id", (invoice as { patient_id: string }).patient_id)
      .maybeSingle();

    const origin = new URL(request.url).origin;
    const typedInvoice = invoice as {
      id: string;
      invoice_number: string | null;
    };

    const typedPatient = (patient || null) as {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;

    const checkout = buildCheckoutUrl(env, {
      amount: balance,
      itemName:
        typedInvoice.invoice_number ||
        `Invoice ${typedInvoice.id.slice(0, 8)}`,
      itemDescription: "Practice invoice payment",
      paymentId: typedInvoice.id,
      returnUrl: `${origin}/invoices/${typedInvoice.id}?payment=success`,
      cancelUrl: `${origin}/invoices/${typedInvoice.id}?payment=cancelled`,
      notifyUrl: `${origin}/api/payfast/notify`,
      customerEmail: typedPatient?.email || null,
      customerFirstName: typedPatient?.first_name || null,
      customerLastName: typedPatient?.last_name || null,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("pay-link error:", error);
    return NextResponse.json(
      { error: "Could not generate the payment link." },
      { status: 500 }
    );
  }
}
