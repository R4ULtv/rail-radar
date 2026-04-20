import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { operators, operatorBySlug, type Operator } from "@repo/data/operators";
import { COUNTRY_MAP, type CountryCode } from "@repo/data/countries";
import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent } from "@repo/ui/components/card";
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
  ExpandIcon,
  TrainTrackIcon,
  UsersIcon,
} from "lucide-react";

interface OperatorPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return operators.map((operator) => ({ slug: operator.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: OperatorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const operator = operatorBySlug.get(slug);

  if (!operator) {
    return { title: "Operator Not Found" };
  }

  const countries = formatCountryList(getTrackedCountries(operator));
  const description = `${operator.name} is tracked on Rail Radar in ${countries}. ${operator.description}`;

  return {
    title: `${operator.name} - Train Operator`,
    description,
    alternates: {
      canonical: `/operators/${slug}`,
    },
    openGraph: {
      title: `${operator.name} - Train Operator | Rail Radar`,
      description,
      images: [
        {
          url: "/og-image-brands.webp",
          width: 1200,
          height: 630,
          alt: "Rail Radar - Train operator directory across Europe",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: `${operator.name} - Train Operator | Rail Radar`,
      description,
      images: [
        {
          url: "/og-image-brands.webp",
          width: 1200,
          height: 630,
          alt: "Rail Radar - Train operator directory across Europe",
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

  for (const b of operators) {
    if (seen.has(b.slug)) continue;
    const bCountries = getTrackedCountries(b);
    if (bCountries.some((c) => operatorCountries.includes(c))) {
      const allShared = bCountries.every((c) => operatorCountries.includes(c));
      if (allShared) sameCountry.push(b);
      else crossCountry.push(b);
      seen.add(b.slug);
    }
  }

  return [...sameCountry, ...crossCountry].slice(0, 4);
}

export default async function OperatorPage({ params }: OperatorPageProps) {
  const { slug } = await params;
  const operator = operatorBySlug.get(slug);

  if (!operator) {
    notFound();
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
      value: `${operator.networkKm.toLocaleString()} km`,
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
        href="/operators"
        className="group/back mb-8 md:mb-12 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 transition-transform duration-150 ease-out group-hover/back:-translate-x-0.5" />
        All operators
      </Link>

      <div className="mb-12">
        <div className="flex items-start gap-5">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-card">
            <Image
              unoptimized
              src={`/brands/${operator.logoPath}.svg`}
              alt={operator.name}
              width={80}
              height={80}
              className="size-full object-contain"
            />
          </div>
          <div className="min-w-0 pt-1">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{operator.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {trackedCountries.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 capitalize"
                  aria-label={COUNTRY_MAP[c]}
                >
                  <Image
                    unoptimized
                    src={`/flags/${c}.svg`}
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
        href={`/?lat=${mapView.lat}&lng=${mapView.lng}&zoom=${mapView.zoom}`}
        className="group/map"
      >
        <Card className="mb-6 overflow-hidden py-0">
          <div className="relative aspect-21/9">
            <Image
              unoptimized
              loading="eager"
              src={`${process.env.NEXT_PUBLIC_API_URL}/map/static?bbox=${operator.bounds.join(",")}&w=960&h=412`}
              alt={`Map of ${operator.name} operating area`}
              fill
              className="object-cover"
            />
            <ExpandIcon className="absolute top-4 right-4 size-4 text-muted-foreground opacity-0 scale-95 transition-[transform,opacity] duration-200 ease-out group-hover/map:opacity-100 group-hover/map:scale-100" />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-card/40 to-transparent p-4 pt-8">
              <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Operating Area
              </h2>
            </div>
          </div>
        </Card>
      </Link>

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
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
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
                    href={`/operators#${c}`}
                    className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5 transition-[background-color,transform] duration-150 ease-out lg:hover:bg-muted/50 active:scale-[0.98]"
                  >
                    <Image
                      unoptimized
                      src={`/flags/${c}.svg`}
                      alt={COUNTRY_MAP[c]}
                      width={18}
                      height={18}
                      className="rounded-sm"
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
                      className="group/link flex items-center gap-3 rounded-lg px-2.5 py-2 -mx-2.5 transition-[background-color,transform] duration-150 ease-out lg:hover:bg-muted/50 active:scale-[0.98]"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 lg:group-hover/link:bg-muted">
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
                      href={`/operators/${b.slug}`}
                      className="group/rel flex items-center gap-3 rounded-lg px-2.5 py-2 -mx-2.5 transition-[background-color,transform] duration-150 ease-out lg:hover:bg-muted/50 active:scale-[0.98]"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background">
                        <Image
                          unoptimized
                          src={`/brands/${b.logoPath}.svg`}
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
                            <Image
                              key={c}
                              unoptimized
                              src={`/flags/${c}.svg`}
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
          {operator.name} is a train operator serving {formatCountryList(trackedCountries)}. View
          trains operated by {operator.name} on Rail Radar, including real-time departures,
          arrivals, delays, and platform information.{" "}
          {operator.serviceTypes.map((t) => serviceTypeLabels[t] ?? t).join(", ")} services
          available.
        </p>
      </div>
    </div>
  );
}
