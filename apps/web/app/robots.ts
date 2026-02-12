import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/*?*lat=*", "/*?*lng=*", "/*?*zoom=*", "/*?*station=*"],
    },
    sitemap: "https://www.railradar24.com/sitemap.xml",
  };
}
