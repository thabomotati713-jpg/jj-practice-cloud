import { Resend } from "resend";
import { adminClient } from "@/lib/serverAccess";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret)
    return Response.json(
      { error: "Delivery webhook is not configured." },
      { status: 503 },
    );
  if (Number(request.headers.get("content-length") || 0) > 200000)
    return new Response(null, { status: 413 });
  let result;
  try {
    const payload = await request.text();
    if (payload.length > 200000) return new Response(null, { status: 413 });
    result = new Resend(process.env.RESEND_API_KEY || "unused").webhooks.verify(
      {
        payload,
        headers: {
          id: request.headers.get("svix-id") || "",
          timestamp: request.headers.get("svix-timestamp") || "",
          signature: request.headers.get("svix-signature") || "",
        },
        webhookSecret: secret,
      },
    );
  } catch {
    return Response.json(
      { error: "Invalid webhook signature." },
      { status: 400 },
    );
  }
  const eventId = request.headers.get("svix-id") || "",
    emailId = "email_id" in result.data ? result.data.email_id : null;
  if (
    !emailId ||
    ![
      "email.delivered",
      "email.bounced",
      "email.failed",
      "email.complained",
    ].includes(result.type)
  )
    return Response.json({ received: true });
  const { error } = await adminClient().rpc("pc_claim_delivery_event", {
    p_event: eventId,
    p_message: emailId,
    p_type: result.type,
  });
  return Response.json(
    error
      ? { error: "Could not record the delivery receipt." }
      : { received: true },
    { status: error ? 500 : 200 },
  );
}
