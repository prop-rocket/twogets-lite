import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/onboarding", "/api"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
