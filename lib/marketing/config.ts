// Account IDs and fields verified through Windsor discovery, 2 October 2026.
export const sources = {
  facebook_organic: {
    account: "1384860684703701",
    label: "Facebook Organic",
    fields: ["date", "page_views_total"],
  },
  googleanalytics4: {
    account: "554700293",
    label: "Google Analytics",
    fields: ["date", "sessions", "screen_page_views"],
  },
  google_my_business: {
    account: "locations/14327148182780829812",
    label: "Google Business",
    fields: ["date", "impressions", "website_clicks"],
  },
  facebook: {
    account: "1326609621664265",
    label: "Facebook Ads · read only",
    fields: ["campaign_id", "campaign", "campaign_status", "spend", "currency"],
  },
  facebook_leads: {
    account: "1384860684703701",
    label: "Facebook Leads",
    fields: ["id", "full_name", "email", "phone_number", "created_time"],
  },
} as const;
export type Connector = keyof typeof sources;
export function organicAction(
  platform: string,
  body: string,
  url: string | null,
) {
  if (!body.trim()) throw new Error("Post copy is required.");
  if (url && new URL(url).protocol !== "https:")
    throw new Error("Publishing links must use HTTPS.");
  if (platform === "facebook")
    return {
      connector: "facebook_organic" as Connector,
      action: "create_post",
      params: { message: body, ...(url ? { link: url } : {}) },
    };
  if (platform === "google_business") {
    if (body.length > 1500)
      throw new Error(
        "Google Business posts must be 1,500 characters or fewer.",
      );
    return {
      connector: "google_my_business" as Connector,
      action: "create_local_post",
      params: {
        summary: body,
        language_code: "en",
        ...(url ? { cta_type: "BOOK", cta_url: url } : {}),
      },
    };
  }
  throw new Error(
    "Automatic publishing supports Facebook and Google Business only. LinkedIn remains pending.",
  );
}
export function validFuture(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\dT.*(Z|[+-]\d\d:\d\d)$/.test(value)
  )
    throw new Error("Use a date with a timezone.");
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time <= Date.now())
    throw new Error("Choose a future date and time.");
  return new Date(time).toISOString();
}
