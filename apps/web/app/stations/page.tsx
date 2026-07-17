import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { COUNTRY_MAP, COUNTRY_CODES, COUNTRY_SLUG } from "@repo/data/countries";
import { stationsByCountry } from "@repo/data/directory";
import { Card, CardContent } from "@repo/ui/components/card";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import baseUrl from "@/lib/base-url";
import { staticAssetUrl } from "@/lib/static-assets";

const totalStations = COUNTRY_CODES.reduce(
  (sum, code) => sum + (stationsByCountry.get(code)?.length ?? 0),
  0,
);

export const metadata: Metadata = {
  title: "Train Stations - Browse by Country",
  description: `Browse ${totalStations.toLocaleString()} train stations across ${COUNTRY_CODES.length} European countries on Rail Radar. Find live departures, arrivals, and real-time schedules for every station.`,
  alternates: {
    canonical: "/stations",
  },
  openGraph: {
    images: [
      {
        url: "/operators.webp",
        width: 1200,
        height: 630,
        alt: "Rail Radar - Train stations across Europe",
      },
    ],
  },
};

export default function StationsPage() {
  const countries = COUNTRY_CODES.map((code) => ({
    code,
    name: COUNTRY_MAP[code],
    slug: COUNTRY_SLUG[code],
    count: stationsByCountry.get(code)?.length ?? 0,
  }))
    .filter((c) => c.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Train Stations by Country",
    url: new URL("/stations", baseUrl).toString(),
    hasPart: countries.map((c) => ({
      "@type": "CollectionPage",
      name: `Train Stations in ${c.name}`,
      url: new URL(`/stations/${c.slug}`, baseUrl).toString(),
    })),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <Link
        href="/"
        className="group/back mb-8 md:mb-12 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 transition-transform duration-150 ease-out group-hover/back:-translate-x-0.5" />
        Back to Rail Radar
      </Link>

      <div className="mb-16">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Directory
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Train Stations</h1>
        <p className="mt-3 text-muted-foreground max-w-lg text-pretty">
          {totalStations.toLocaleString()} train stations tracked across {countries.length}{" "}
          countries in real time on Rail Radar. Browse by country to find live departures and
          arrivals.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {countries.map((country) => (
          <Link key={country.code} href={`/stations/${country.slug}`} className="group">
            <Card
              size="sm"
              className="h-full transition-[background-color,box-shadow,transform] ease-[cubic-bezier(0.23,1,0.32,1)] duration-200 lg:group-hover:bg-muted/40 lg:group-hover:ring-foreground/20 group-active:scale-[0.98]"
            >
              <CardContent className="flex items-center gap-3">
                <Image
                  unoptimized
                  src={staticAssetUrl(`/flags/${country.code}.svg`)}
                  alt={country.name}
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-full"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium tracking-tight truncate lg:group-hover:text-foreground">
                    {country.name}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {country.count.toLocaleString()} stations
                  </div>
                </div>
                <ArrowRightIcon className="size-3.5 text-muted-foreground opacity-0 -translate-x-1 transition-[opacity,transform] ease-[cubic-bezier(0.23,1,0.32,1)] duration-200 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
