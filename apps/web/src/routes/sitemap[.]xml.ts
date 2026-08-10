import { createFileRoute } from "@tanstack/react-router";
import { stations } from "@repo/data/stations";
import { stationsByCountry } from "@repo/data/directory";
import { operators } from "@repo/data/operators";
import { COUNTRY_CODES, COUNTRY_SLUG } from "@repo/data/countries";
import { env } from "@/lib/env";

type SitemapEntry = {
  path: string;
  changeFrequency: "daily" | "monthly" | "yearly";
  priority: number;
  lastModified?: string;
};

function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '\"': "&quot;",
      "'": "&apos;",
    };
    return entities[character]!;
  });
}

function sitemapXml() {
  const today = new Date().toISOString();
  const entries: SitemapEntry[] = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/operators", changeFrequency: "monthly", priority: 0.6 },
    { path: "/stations", changeFrequency: "monthly", priority: 0.7 },
    { path: "/donate", changeFrequency: "monthly", priority: 0.5 },
    {
      path: "/report/2026-04-28",
      lastModified: "2026-04-28T00:00:00.000Z",
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      path: "/report/2026-07-24",
      lastModified: "2026-07-24T00:00:00.000Z",
      changeFrequency: "yearly",
      priority: 0.4,
    },
    ...COUNTRY_CODES.filter((code) => (stationsByCountry.get(code)?.length ?? 0) > 0).map(
      (code): SitemapEntry => ({
        path: `/stations/${COUNTRY_SLUG[code]}`,
        changeFrequency: "monthly",
        priority: 0.6,
      }),
    ),
    ...stations
      .filter((station) => station.type === "rail" && station.geo)
      .map(
        (station): SitemapEntry => ({
          path: `/station/${station.id}`,
          changeFrequency: "daily",
          priority: 0.7,
        }),
      ),
    ...operators.map(
      (operator): SitemapEntry => ({
        path: `/operators/${operator.slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
      }),
    ),
  ];

  const urls = entries
    .map((entry) => {
      const url = new URL(entry.path, env.siteUrl).toString();
      return `<url><loc>${xmlEscape(url)}</loc><lastmod>${entry.lastModified ?? today}</lastmod><changefreq>${entry.changeFrequency}</changefreq><priority>${entry.priority.toFixed(1)}</priority></url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(sitemapXml(), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
          },
        }),
    },
  },
});
