import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://jj-practice-cloud-m2ts.vercel.app";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/signup"],
      disallow: [
        "/api/",
        "/dashboard",
        "/patients",
        "/appointments",
        "/prescriptions",
        "/sick-notes",
        "/invoices",
        "/claims",
        "/inventory",
        "/staff",
        "/settings",
        "/audit",
        "/superuser",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
