import { MetadataRoute } from "next";
import { stationsCoords } from "@repo/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.railradar24.com";

  // Homepage
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  // Station pages
  const stationRoutes: MetadataRoute.Sitemap = stationsCoords.map(
    (station) => ({
      url: `${baseUrl}/station/${station.id}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })
  );

  return [...routes, ...stationRoutes];
}
