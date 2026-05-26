import { MetadataRoute } from "next";
import { stations } from "@repo/data/stations";
import { operators } from "@repo/data/operators";
import baseUrl from "@/lib/base-url";

function absoluteUrl(pathname: string): string {
  return new URL(pathname, baseUrl).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const stationRoutes: MetadataRoute.Sitemap = stations.reduce<MetadataRoute.Sitemap>(
    (routes, station) => {
      if (station.type !== "rail" || !station.geo) return routes;

      routes.push({
        url: absoluteUrl(`/station/${station.id}`),
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.7,
      });
      return routes;
    },
    [],
  );

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
      url: absoluteUrl("/donate"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
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
