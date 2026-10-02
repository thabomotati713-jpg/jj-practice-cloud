import "server-only";
import { sources, type Connector, organicAction } from "./config";
export function configured() {
  return Boolean(process.env.WINDSOR_API_KEY);
}
async function call(
  connector: Connector,
  suffix = "",
  params: Record<string, string> = {},
  body?: unknown,
): Promise<unknown> {
  const key = process.env.WINDSOR_API_KEY;
  if (!key)
    throw new Error(
      "Add WINDSOR_API_KEY to the Vercel server environment to enable live sync and publishing.",
    );
  const url = new URL(`https://connectors.windsor.ai/${connector}${suffix}`);
  url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Never log the URL: Windsor requires the key in its query string.
  try {
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error(
        `Windsor request failed (${response.status}). Check account permissions and plan limits.`,
      );
    const data = await response.json();
    if (data?.error || data?.isError)
      throw new Error(
        "Windsor could not complete this request. Check the connection.",
      );
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Windsor"))
      throw error;
    throw new Error(
      "Windsor request interrupted. Check the provider before retrying a publication.",
    );
  }
}
function array(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object")
    for (const key of ["data", "result", "actions"]) {
      const value = (data as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
  throw new Error("Windsor returned an unexpected response.");
}
export async function readSource(
  connector: Connector,
  from: string,
  to: string,
) {
  const source = sources[connector];
  return array(
    await call(connector, "", {
      fields: source.fields.join(","),
      select_accounts: source.account,
      date_from: from,
      date_to: to,
    }),
  );
}
export async function publishOrganic(
  platform: string,
  body: string,
  url: string | null,
) {
  const action = organicAction(platform, body, url);
  const available = array(await call(action.connector, "/actions"));
  if (!available.some((item) => item.id === action.action))
    throw new Error("Organic publishing is not available for this connection.");
  return call(
    action.connector,
    "/actions",
    {},
    {
      account: sources[action.connector].account,
      action: action.action,
      params: action.params,
    },
  );
}
