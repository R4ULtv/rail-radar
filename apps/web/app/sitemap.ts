import { MetadataRoute } from "next";
import { stations } from "@repo/data/stations";
import { stationsByCountry } from "@repo/data/directory";
import { operators } from "@repo/data/operators";
import { COUNTRY_CODES, COUNTRY_SLUG } from "@repo/data/countries";
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

  const countryRoutes: MetadataRoute.Sitemap = COUNTRY_CODES.filter(
    (code) => (stationsByCountry.get(code)?.length ?? 0) > 0,
  ).map((code) => ({
    url: absoluteUrl(`/stations/${COUNTRY_SLUG[code]}`),
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
      url: absoluteUrl("/stations"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
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
    {
      url: absoluteUrl("/report/2026-07-24"),
      lastModified: new Date("2026-07-24"),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    ...countryRoutes,
    ...stationRoutes,
    ...operatorRoutes,
  ];
}
