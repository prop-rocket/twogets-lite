import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/properties`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/signup`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
