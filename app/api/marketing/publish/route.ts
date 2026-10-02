import { requireProfile, accessError } from "@/lib/serverAccess";
import { publishPost } from "@/lib/marketing/service";
export const maxDuration = 60;
export async function POST(request: Request) {
  let admin;
  try {
    ({ admin } = await requireProfile(request, true));
  } catch (error) {
    return accessError(error);
  }
  try {
    const body = await request.json();
    if (typeof body.postId !== "string")
      return Response.json({ error: "Post ID required." }, { status: 400 });
    return Response.json(await publishPost(admin, body.postId));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Publishing failed." },
      { status: 409 },
    );
  }
}
