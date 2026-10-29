import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { metadataToHead, type Metadata } from "@/lib/metadata";
import { lines } from "@repo/data/lines";
import { operators, operatorBySlug, type Operator } from "@repo/data/operators";
import { COUNTRY_MAP, type CountryCode } from "@repo/data/countries";
import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { LineBadge } from "@/components/line-badge";
import { loadOperatorLines } from "@/lib/line-data.functions";
import type { DirectoryLine, OperatorLinesData } from "@/lib/line-data.server";
import {
  operatorTypeColors,
  operatorTypeLabels,
  OperatorTypeMarker,
  operatorRole,
  sortOperatorTypes,
} from "@/lib/operator-types";
import { staticAssetUrl } from "@/lib/static-assets";
import { prerenderedPageLinkProps } from "@/lib/station-prerender";
import { env } from "@/lib/env";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MapPinIcon,
  BuildingIcon,
  GlobeIcon,
  ExternalLinkIcon,
  ClockIcon,
  CodeIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  ExpandIcon,
  TrainTrackIcon,
  UsersIcon,
} from "lucide-react";

export const Route = createFileRoute("/operators/$slug")({
  loader: async ({ params }) => {
    if (!operatorBySlug.has(params.slug)) throw notFound();
    const network = await loadOperatorLines({ data: { slug: params.slug } });
    return { slug: params.slug, network };
  },
  head: ({ params }) => metadataToHead(getOperatorMetadata(params.slug)),
  component: OperatorRoute,
});

function OperatorRoute() {
  const { slug, network } = Route.useLoaderData();
  return <OperatorPage slug={slug} network={network} />;
}

function getOperatorMetadata(slug: string): Metadata {
  const operator = operatorBySlug.get(slug);

  if (!operator) {
    return { title: "Operator Not Found" };
  }

  const countries = formatCountryList(getTrackedCountries(operator));
  const lineCount = lines.filter((line) => line.operator === slug).length;
  const lineSummary =
    lineCount > 0 ? ` It runs ${lineCount} line${lineCount === 1 ? "" : "s"} on Rail Radar.` : "";
  const description = `${operator.name} is tracked on Rail Radar in ${countries}.${lineSummary} ${operator.description}`;
  const title = `${operator.name} - ${operatorRole(operator.operatorTypes)}`;

  return {
    title,
    description,
    alternates: {
      canonical: `/operators/${slug}`,
    },
    openGraph: {
      title: `${title} | Rail Radar`,
      description,
      images: [
        {
          url: "/assets/social/operators.webp",
          width: 1200,
          height: 630,
          alt: "Rail Radar - Rail operator directory across Europe",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: `${title} | Rail Radar`,
      description,
      images: [
        {
          url: "/assets/social/operators.webp",
          width: 1200,
          height: 630,
          alt: "Rail Radar - Rail operator directory across Europe",
        },
      ],
    },
  };
}

const serviceTypeLabels: Record<string, string> = {
  "high-speed": "High Speed",
  intercity: "Intercity",
  regional: "Regional",
  commuter: "Commuter",
  "night-train": "Night Train",
  international: "International",
  scenic: "Scenic",
  intermodal: "Intermodal",
  wagonload: "Wagonload",
  "block-train": "Block Train",
};

const linkIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  website: GlobeIcon,
  timetables: ClockIcon,
  api: CodeIcon,
  wikipedia: BookOpenIcon,
};

function formatNumber(n: number): string {
  if (n >= 1_000_000_000)
    return `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 2).replace(/\.?0+$/, "")}B`;
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1).replace(/\.?0+$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1).replace(/\.?0+$/, "")}K`;
  return String(n);
}

function isTrackedCountry(country: Operator["countries"][number]): country is CountryCode {
  return country !== "international";
}

function getTrackedCountries(operator: Operator): CountryCode[] {
  return operator.countries.filter(isTrackedCountry);
}

function formatCountryList(countries: CountryCode[]): string {
  return countries.length > 0 ? countries.map((c) => COUNTRY_MAP[c]).join(", ") : "international";
}

function boundsToView(bounds: Operator["bounds"]): { lat: number; lng: number; zoom: number } {
  const [west, south, east, north] = bounds;
  const lat = (south + north) / 2;
  const lng = (west + east) / 2;

  const latSpan = north - south;
  const lngSpan = east - west;
  const maxSpan = Math.max(latSpan, lngSpan);
  const zoom = Math.floor(Math.log2(360 / maxSpan));

  return { lat: +lat.toFixed(4), lng: +lng.toFixed(4), zoom: Math.min(zoom, 18) };
}

function getRelatedOperators(operator: Operator): Operator[] {
  const seen = new Set<string>([operator.slug]);
  const sameCountry: Operator[] = [];
  const crossCountry: Operator[] = [];
  const operatorCountries = getTrackedCountries(operator);
  const operatorCountrySet = new Set(operatorCountries);

  for (const b of operators) {
    if (seen.has(b.slug)) continue;
    const bCountries = getTrackedCountries(b);
    if (bCountries.some((c) => operatorCountrySet.has(c))) {
      const allShared = bCountries.every((c) => operatorCountrySet.has(c));
      if (allShared) sameCountry.push(b);
      else crossCountry.push(b);
      seen.add(b.slug);
    }
  }

  // Within each group, operators of the same kind first: a metro is closer to the
  // city's trams than to the national railway, so metro and light rail count as one.
  const modes = (o: Operator) =>
    o.operatorTypes.map((type) => (type === "light-rail" ? "metro" : type));
  const sharesType = (b: Operator) =>
    modes(b).some((mode) => modes(operator).includes(mode)) ? 0 : 1;
  const byType = (a: Operator, b: Operator) => sharesType(a) - sharesType(b);

  return [...sameCountry.sort(byType), ...crossCountry.sort(byType)].slice(0, 4);
}

function OperatorPage({ slug, network }: { slug: string; network: OperatorLinesData | null }) {
  const operator = operatorBySlug.get(slug);
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);

  if (!operator) {
    return null;
  }

  const relatedOperators = getRelatedOperators(operator);
  const trackedCountries = getTrackedCountries(operator);
  const mapView = boundsToView(operator.bounds);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: operator.name,
    url: operator.website,
    description: operator.description,
    ...(operator.founded && { foundingDate: String(operator.founded) }),
    ...(operator.headquarters && {
      address: {
        "@type": "PostalAddress",
        addressLocality: operator.headquarters,
      },
    }),
    ...(operator.parentCompany && {
      parentOrganization: {
        "@type": "Organization",
        name: operator.parentCompany,
      },
    }),
  };

  const facts: {
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [];
  if (operator.founded)
    facts.push({ label: "Founded", value: String(operator.founded), icon: CalendarDaysIcon });
  if (operator.headquarters)
    facts.push({ label: "Headquarters", value: operator.headquarters, icon: MapPinIcon });
  if (operator.parentCompany)
    facts.push({ label: "Parent Company", value: operator.parentCompany, icon: BuildingIcon });
  if (operator.networkKm)
    facts.push({
      label: "Network Length",
      value: `${operator.networkKm.toLocaleString("en-US")} km`,
      icon: TrainTrackIcon,
    });
  if (operator.annualPassengers)
    facts.push({
      label: "Annual Passengers",
      value: `~${formatNumber(operator.annualPassengers)}`,
      icon: UsersIcon,
    });
  facts.push({
    label: "Tracked Countries",
    value: formatCountryList(trackedCountries),
    icon: GlobeIcon,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <Link
        to="/operators"
        className="group/back mb-8 md:mb-12 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 transition-transform duration-150 ease-out group-hover/back:-translate-x-0.5" />
        All operators
      </Link>

      <div className="mb-12">
        <div className="flex items-start gap-5">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-card">
            <img
              src={staticAssetUrl(`/operators/${operator.logoPath}.svg`)}
              alt={operator.name}
              width={80}
              height={80}
              className="size-full object-contain"
            />
          </div>
          <div className="min-w-0 pt-1">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{operator.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {trackedCountries.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 capitalize"
                  aria-label={COUNTRY_MAP[c]}
                >
                  <img
                    src={staticAssetUrl(`/flags/${c}.svg`)}
                    alt={COUNTRY_MAP[c]}
                    width={16}
                    height={16}
                    className="size-4 rounded-full ring-1 ring-foreground/10"
                  />
                  <span className="hidden sm:inline">{COUNTRY_MAP[c]}</span>
                </span>
              ))}
              {operator.founded && (
                <>
                  <span className="text-foreground/15 hidden sm:inline">|</span>
                  <span>Est. {operator.founded}</span>
                </>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sortOperatorTypes(operator.operatorTypes).map((type) => (
                <Link
                  key={type}
                  to="/operators"
                  search={{ type }}
                  className="inline-flex h-6 items-center gap-1.5 rounded-3xl py-0.5 pr-2.5 pl-1 text-xs font-medium transition-[filter] duration-150 ease-out hover:brightness-125"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${operatorTypeColors[type]} 18%, transparent)`,
                  }}
                >
                  <OperatorTypeMarker type={type} className="size-4.5" />
                  {operatorTypeLabels[type]}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-8 text-[15px] leading-relaxed text-muted-foreground">
          {operator.description}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {operator.serviceTypes.map((type) => (
            <Badge key={type} variant="outline" className="font-normal">
              {serviceTypeLabels[type] ?? type}
            </Badge>
          ))}
        </div>
      </div>

      <Link
        to="/"
        search={{ lat: mapView.lat, lng: mapView.lng, zoom: mapView.zoom }}
        className="group/map"
      >
        <Card className="mb-6 overflow-hidden py-0">
          <div className="relative aspect-21/9">
            <img
              loading="eager"
              src={`${env.apiUrl}/map/static?bbox=${operator.bounds.join(",")}&w=960&h=412`}
              alt={`Map of ${operator.name} operating area`}
              sizes="(max-width: 768px) calc(100vw - 32px), 848px"
              className="absolute inset-0 size-full object-cover"
            />
            {network && network.tracks.length > 0 && (
              <NetworkTracks tracks={network.tracks} highlighted={hoveredLine} />
            )}
            <ExpandIcon className="absolute top-4 right-4 size-4 text-muted-foreground opacity-0 scale-95 transition-[transform,opacity] duration-200 ease-out group-hover/map:opacity-100 group-hover/map:scale-100" />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-card/40 to-transparent p-4 pt-8">
              <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Operating Area
              </h2>
            </div>
          </div>
        </Card>
      </Link>

      {network && network.lines.length > 0 && (
        <OperatorLines
          lines={network.lines}
          stations={network.stations}
          onHover={setHoveredLine}
          className="mb-6"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-3 space-y-6">
          <Card>
            <CardContent>
              <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-4">
                Key Facts
              </h2>
              <dl className="space-y-4">
                {facts.map((fact) => {
                  const Icon = fact.icon;
                  return (
                    <div key={fact.label} className="flex items-start gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-muted/50">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div className="pt-0.5">
                        <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                        <dd className="text-sm font-medium capitalize">{fact.value}</dd>
                      </div>
                    </div>
                  );
                })}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-4">
                Tracked in{" "}
                {trackedCountries.length === 1
                  ? "1 country"
                  : `${trackedCountries.length} countries`}
              </h2>
              <div className="space-y-2">
                {trackedCountries.map((c) => (
                  <Link
                    key={c}
                    to="/operators"
                    hash={c}
                    className="flex items-center gap-3 rounded-2xl bg-muted/30 px-3 py-2.5 transition-[background-color,transform] duration-150 ease-out lg:hover:bg-muted/50 active:scale-[0.98]"
                  >
                    <img
                      src={staticAssetUrl(`/flags/${c}.svg`)}
                      alt={COUNTRY_MAP[c]}
                      width={18}
                      height={18}
                      className="rounded-lg"
                    />
                    <span className="text-sm font-medium capitalize">{COUNTRY_MAP[c]}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardContent>
              <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-4">
                Resources
              </h2>
              <div className="space-y-1">
                {operator.links.map((link) => {
                  const Icon = linkIcons[link.type] ?? GlobeIcon;
                  return (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/link -mx-2.5 flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-[background-color,transform] duration-150 ease-out lg:hover:bg-muted/50 active:scale-[0.98]"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-muted/50 lg:group-hover/link:bg-muted">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{link.label}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {link.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                        </div>
                      </div>
                      <ExternalLinkIcon className="size-3.5 text-muted-foreground opacity-0 lg:group-hover/link:opacity-100 transition-opacity duration-150 ease-out shrink-0" />
                    </a>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {relatedOperators.length > 0 && (
            <Card>
              <CardContent>
                <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-4">
                  Related Operators
                </h2>
                <div>
                  {relatedOperators.map((b) => (
                    <Link
                      key={b.slug}
                      to="/operators/$slug"
                      params={{ slug: b.slug }}
                      {...prerenderedPageLinkProps}
                      className="group/rel -mx-2.5 flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-[background-color,transform] duration-150 ease-out lg:hover:bg-muted/50 active:scale-[0.98]"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-background">
                        <img
                          src={staticAssetUrl(`/operators/${b.logoPath}.svg`)}
                          alt={b.name}
                          width={32}
                          height={32}
                          className="size-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{b.name}</span>
                        {getTrackedCountries(b)
                          .slice(0, 2)
                          .map((c) => (
                            <img
                              key={c}
                              src={staticAssetUrl(`/flags/${c}.svg`)}
                              alt={COUNTRY_MAP[c]}
                              width={14}
                              height={14}
                              className="size-3.5 rounded-full ring-1 ring-foreground/10 shrink-0"
                            />
                          ))}
                      </div>
                      <ArrowRightIcon className="size-3.5 text-muted-foreground opacity-0 lg:group-hover/rel:opacity-100 transition-opacity duration-150 ease-out shrink-0" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="sr-only">
        <h2>About {operator.name}</h2>
        <p>
          {operator.name} is a {operatorRole(operator.operatorTypes).toLowerCase()} serving{" "}
          {formatCountryList(trackedCountries)}.{" "}
          {operator.operatorTypes.includes("passenger") &&
            `View trains operated by ${operator.name} on Rail Radar, including real-time departures, arrivals, delays, and platform information. `}
          {operator.serviceTypes.length > 0 &&
            `${operator.serviceTypes.map((t) => serviceTypeLabels[t] ?? t).join(", ")} services available.`}
          {network &&
            network.lines.length > 0 &&
            ` ${operator.name} runs ${network.lines.map((line) => line.name).join(", ")}.`}
        </p>
      </div>
    </div>
  );
}

const lineModes = [
  { type: "metro", marker: "metro" },
  { type: "light", marker: "light-rail" },
] as const;

/** The operator's lines, drawn over its operating area like the line pages draw one line. */
function NetworkTracks({
  tracks,
  highlighted,
}: {
  tracks: OperatorLinesData["tracks"];
  highlighted: string | null;
}) {
  return (
    <svg
      viewBox="0 0 960 412"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
      aria-hidden
    >
      {tracks.map((track) => (
        <path
          key={`casing-${track.id}`}
          d={track.path}
          fill="none"
          stroke="#000"
          strokeOpacity={highlighted && highlighted !== track.id ? 0.1 : 0.35}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-[stroke-opacity] duration-150"
        />
      ))}
      {/* The highlighted line is drawn last so it sits on top of shared track. */}
      {[...tracks]
        .sort((a, b) => Number(a.id === highlighted) - Number(b.id === highlighted))
        .map((track) => (
          <path
            key={track.id}
            d={track.path}
            fill="none"
            stroke={track.color}
            strokeOpacity={highlighted && highlighted !== track.id ? 0.25 : 1}
            strokeWidth={highlighted === track.id ? 4.5 : 3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-[stroke-opacity,stroke-width] duration-150"
          />
        ))}
    </svg>
  );
}

function OperatorLines({
  lines,
  stations,
  onHover,
  className,
}: {
  lines: DirectoryLine[];
  stations: number;
  onHover: (id: string | null) => void;
  className?: string;
}) {
  const groups = lineModes
    .map((mode) => ({ ...mode, lines: lines.filter((line) => line.type === mode.type) }))
    .filter((group) => group.lines.length > 0);

  return (
    <Card size="sm" className={cn("gap-0 py-0", className)}>
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Lines
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {lines.length} line{lines.length === 1 ? "" : "s"} · {stations} station
          {stations === 1 ? "" : "s"}
        </span>
      </div>
      <div className="border-t border-foreground/5 p-1.5" onMouseLeave={() => onHover(null)}>
        {groups.map((group) => (
          <div key={group.type}>
            {groups.length > 1 && (
              <h3 className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                <OperatorTypeMarker type={group.marker} className="size-4" />
                {operatorTypeLabels[group.marker]}
              </h3>
            )}
            <ul className={cn(group.lines.length > 3 && "md:columns-2 md:gap-1.5")}>
              {group.lines.map((line) => (
                <li key={line.id} className="break-inside-avoid">
                  <Link
                    to="/lines/$id"
                    params={{ id: line.id }}
                    {...prerenderedPageLinkProps}
                    onMouseEnter={() => onHover(line.id)}
                    onFocus={() => onHover(line.id)}
                    onBlur={() => onHover(null)}
                    className="group flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors duration-150 lg:hover:bg-muted/60"
                  >
                    <LineBadge line={line} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {line.routeCodes.length
                        ? `${line.name} · ${line.routeCodes.join(" / ")}`
                        : line.loop
                          ? `Circle line via ${line.from}`
                          : `${line.from} – ${line.to}`}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {line.stations}
                      <span className="sr-only"> stations</span>
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60 transition-transform duration-150 lg:group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
