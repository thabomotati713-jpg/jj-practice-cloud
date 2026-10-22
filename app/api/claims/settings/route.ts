import {
  claimAccess,
  claimConfig,
  claimFailure,
  saveClaimConfig,
  emailReady,
} from "@/lib/claims/service";
import { SCHEME_ROUTES } from "@/lib/claims/model";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { admin, practiceId, profile } = await claimAccess(request);
    const [config, { data: providers }] = await Promise.all([
      claimConfig(admin, practiceId),
      admin
        .from("profiles")
        .select("id,first_name,last_name,display_name,active")
        .eq("practice_id", practiceId)
        .in("role", ["owner", "doctor"])
        .order("first_name")
        .limit(100),
    ]);
    return Response.json(
      {
        config,
        providers: providers || [],
        routes: SCHEME_ROUTES,
        canEdit: ["owner", "admin"].includes(profile.role),
        emailConfigured: emailReady(),
        deliveryWebhookConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return claimFailure(e);
  }
}
export async function PUT(request: Request) {
  try {
    const { admin, practiceId, user } = await claimAccess(request, true);
    const config = await saveClaimConfig(
      admin,
      practiceId,
      user.id,
      await request.json(),
    );
    return Response.json(
      { config },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return claimFailure(e);
  }
}
