import { MetadataRoute } from "next";
import { stationsCoords } from "@repo/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.railradar24.com";

  const stationRoutes: MetadataRoute.Sitemap = stationsCoords
    .filter((station) => station.geo)
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
