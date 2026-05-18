import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { operators } from "@repo/data/operators";
import { COUNTRY_MAP, COUNTRY_CODES } from "@repo/data/countries";
import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent } from "@repo/ui/components/card";
import { ArrowLeftIcon, ArrowRightIcon, GlobeIcon } from "lucide-react";

import { staticAssetUrl } from "@/lib/static-assets";
export const metadata: Metadata = {
  title: "Train Operators - All Operators",
  description:
    "Browse all train operators tracked by Rail Radar, including Trenitalia, SBB, VR, SNCB, and more. Find information about each operator, their routes, and services.",
  alternates: {
    canonical: "/operators",
  },
  openGraph: {
    images: [
      {
        url: "/operators.webp",
        width: 1200,
        height: 630,
        alt: "Rail Radar - Train Operators across 12 countries",
      },
    ],
  },
};

const serviceTypeLabels: Record<string, string> = {
  "high-speed": "High Speed",
  intercity: "Intercity",
  regional: "Regional",
  commuter: "Commuter",
  "night-train": "Night Train",
  international: "International",
  scenic: "Scenic",
};

const OPERATOR_GROUPS = ["international", ...COUNTRY_CODES] as const;

export default function OperatorsPage() {
  const operatorsByCountry = Object.fromEntries(
    Object.entries(
      operators.reduce<Record<string, typeof operators>>((acc, operator) => {
        for (const country of operator.countries) {
          (acc[country] ??= []).push(operator);
        }
        return acc;
      }, {}),
    ).map(([country, countryOperators]) => [
      country,
      countryOperators.sort(
        (a, b) => (b.countries[0] === country ? 1 : 0) - (a.countries[0] === country ? 1 : 0),
      ),
    ]),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-16">
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
        <h1 className="text-4xl font-semibold tracking-tight">Train Operators</h1>
        <p className="mt-3 text-muted-foreground max-w-lg text-pretty">
          {operators.length} train operators tracked across {COUNTRY_CODES.length} countries in real
          time on Rail Radar.
        </p>
      </div>

      <div className="space-y-16">
        {OPERATOR_GROUPS.map((country) => {
          const countryOperators = operatorsByCountry[country];
          if (!countryOperators?.length) return null;
          const isInternational = country === "international";
          const countryLabel = isInternational ? "International" : COUNTRY_MAP[country];

          return (
            <section key={country} id={country}>
              <div className="flex items-center gap-3 mb-6">
                {isInternational ? (
                  <div className="flex items-center justify-center rounded-full">
                    <GlobeIcon className="size-7 text-foreground" />
                  </div>
                ) : (
                  <Image
                    unoptimized
                    src={staticAssetUrl(`/flags/${country}.svg`)}
                    alt={countryLabel}
                    width={28}
                    height={28}
                    className="size-7 rounded-full"
                  />
                )}
                <div className="shrink-0">
                  <h2 className="text-lg font-semibold tracking-tight">{countryLabel}</h2>
                  <p className="text-xs text-muted-foreground">
                    {`${countryOperators.length} operator${countryOperators.length > 1 ? "s" : ""}`}
                  </p>
                </div>
                <div className="h-px w-full ml-4 bg-muted" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {countryOperators.map((operator) => (
                  <Link key={operator.slug} href={`/operators/${operator.slug}`} className="group">
                    <Card
                      size="sm"
                      className="h-full transition-[background-color,box-shadow,transform] ease-[cubic-bezier(0.23,1,0.32,1)] duration-200 lg:group-hover:bg-muted/40 lg:group-hover:ring-foreground/20 group-active:scale-[0.98]"
                    >
                      <CardContent className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background">
                          <Image
                            unoptimized
                            src={staticAssetUrl(`/operators/${operator.logoPath}.svg`)}
                            alt={operator.name}
                            width={40}
                            height={40}
                            className="size-full object-contain"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium tracking-tight truncate lg:group-hover:text-foreground">
                            {operator.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {operator.serviceTypes.slice(0, 2).map((type) => (
                              <Badge
                                key={type}
                                variant="secondary"
                                className="h-4.5 px-1.5 text-[10px] font-normal"
                              >
                                {serviceTypeLabels[type] ?? type}
                              </Badge>
                            ))}
                            {operator.serviceTypes.length > 2 && (
                              <span className="text-[10px] text-muted-foreground self-center">
                                +{operator.serviceTypes.length - 2}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRightIcon className="size-3.5 text-muted-foreground opacity-0 -translate-x-1 transition-[opacity,transform] ease-[cubic-bezier(0.23,1,0.32,1)] duration-200 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
