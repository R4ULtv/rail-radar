import { MetadataRoute } from "next";
import { stations } from "@repo/data";
import baseUrl from "@/lib/base-url";

export default function sitemap(): MetadataRoute.Sitemap {
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
      url: baseUrl.toString(),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...stationRoutes,
  ];
}
