import { MetadataRoute } from "next";
import { stations } from "@repo/data/stations";
import { brands } from "@repo/data/brands";
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

  const operatorRoutes: MetadataRoute.Sitemap = brands.map((operator) => ({
    url: `${baseUrl}/operators/${operator.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    {
      url: baseUrl.toString(),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/operators`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...stationRoutes,
    ...operatorRoutes,
  ];
}
