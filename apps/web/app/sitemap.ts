import { MetadataRoute } from "next";
import { stations } from "@repo/data/stations";
import { operators } from "@repo/data/operators";
import baseUrl from "@/lib/base-url";

function absoluteUrl(pathname: string): string {
  return new URL(pathname, baseUrl).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const stationRoutes: MetadataRoute.Sitemap = stations
    .filter((station) => station.type === "rail" && station.geo)
    .map((station) => ({
      url: absoluteUrl(`/station/${station.id}`),
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

  const operatorRoutes: MetadataRoute.Sitemap = operators.map((operator) => ({
    url: absoluteUrl(`/operators/${operator.slug}`),
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    {
      url: absoluteUrl("/"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/operators"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/report/2026-04-28"),
      lastModified: new Date("2026-04-28"),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    ...stationRoutes,
    ...operatorRoutes,
  ];
}
