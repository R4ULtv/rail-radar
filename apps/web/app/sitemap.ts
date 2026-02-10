import { MetadataRoute } from "next";
import { stations } from "@repo/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.railradar24.com";

  const stationRoutes: MetadataRoute.Sitemap = stations
    .filter((station) => station.type === "rail" && station.geo)
    .map((station) => ({
      url: `${baseUrl}/station/${station.id}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...stationRoutes,
  ];
}
