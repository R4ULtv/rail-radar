import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { brands, brandBySlug, COUNTRY_MAP, type Brand } from "@repo/data";
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
  TrainTrackIcon,
  UsersIcon,
} from "lucide-react";

interface BrandPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return brands.map((b) => ({ slug: b.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = brandBySlug.get(slug);

  if (!brand) {
    return { title: "Brand Not Found" };
  }

  const countries = brand.countries.map((c) => COUNTRY_MAP[c]).join(", ");
  const description = `${brand.name} - train operator in ${countries}. ${brand.description}`;

  return {
    title: `${brand.name} - Train Operator`,
    description,
    alternates: {
      canonical: `/operators/${slug}`,
    },
    openGraph: {
      title: `${brand.name} - Train Operator | Rail Radar`,
      description,
      images: [
        {
          url: "/og-image-brands.webp",
          width: 1200,
          height: 630,
          alt: "Rail Radar - Train Operators across 5 countries",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: `${brand.name} - Train Operator | Rail Radar`,
      description,
      images: [
        {
          url: "/og-image-brands.webp",
          width: 1200,
          height: 630,
          alt: "Rail Radar - Train Operators across 5 countries",
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

function getRelatedBrands(brand: Brand): Brand[] {
  const related: Brand[] = [];
  const seen = new Set<string>([brand.slug]);

  for (const b of brands) {
    if (seen.has(b.slug)) continue;
    if (b.countries.some((c) => brand.countries.includes(c))) {
      related.push(b);
      seen.add(b.slug);
    }
    if (related.length >= 4) break;
  }

  return related;
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { slug } = await params;
  const brand = brandBySlug.get(slug);

  if (!brand) {
    notFound();
  }

  const relatedBrands = getRelatedBrands(brand);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    url: brand.website,
    description: brand.description,
    ...(brand.founded && { foundingDate: String(brand.founded) }),
    ...(brand.headquarters && {
      address: {
        "@type": "PostalAddress",
        addressLocality: brand.headquarters,
      },
    }),
    ...(brand.parentCompany && {
      parentOrganization: {
        "@type": "Organization",
        name: brand.parentCompany,
      },
    }),
  };

  const facts: {
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [];
  if (brand.founded)
    facts.push({ label: "Founded", value: String(brand.founded), icon: CalendarDaysIcon });
  if (brand.headquarters)
    facts.push({ label: "Headquarters", value: brand.headquarters, icon: MapPinIcon });
  if (brand.parentCompany)
    facts.push({ label: "Parent Company", value: brand.parentCompany, icon: BuildingIcon });
  if (brand.networkKm)
    facts.push({
      label: "Network Length",
      value: `${brand.networkKm.toLocaleString()} km`,
      icon: TrainTrackIcon,
    });
  if (brand.annualPassengers)
    facts.push({
      label: "Annual Passengers",
      value: `~${formatNumber(brand.annualPassengers)}`,
      icon: UsersIcon,
    });
  facts.push({
    label: "Countries",
    value: brand.countries.map((c) => COUNTRY_MAP[c]).join(", "),
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
              src={`/brands/${brand.logoPath}.svg`}
              alt={brand.name}
              width={80}
              height={80}
              className="size-full object-contain"
            />
          </div>
          <div className="min-w-0 pt-1">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{brand.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {brand.countries.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 capitalize">
                  <Image
                    unoptimized
                    src={`/flags/${c}.svg`}
                    alt={COUNTRY_MAP[c]}
                    width={16}
                    height={16}
                    className="size-4 rounded-full ring-1 ring-foreground/10"
                  />
                  {COUNTRY_MAP[c]}
                </span>
              ))}
              {brand.founded && (
                <>
                  <span className="text-foreground/15 hidden sm:inline">|</span>
                  <span>Est. {brand.founded}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <p className="mt-8 text-[15px] leading-relaxed text-muted-foreground">
          {brand.description}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {brand.serviceTypes.map((type) => (
            <Badge key={type} variant="outline" className="font-normal">
              {serviceTypeLabels[type] ?? type}
            </Badge>
          ))}
        </div>
      </div>

      <Card className="mb-6 overflow-hidden py-0">
        <div className="relative aspect-21/9">
          <Image
            unoptimized
            loading="eager"
            src={`${process.env.NEXT_PUBLIC_API_URL}/map/static?bbox=${brand.bounds.join(",")}&w=960&h=412`}
            alt={`Map of ${brand.name} operating area`}
            fill
            className="object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-card/40 to-transparent p-4 pt-8">
            <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Operating Area
            </h2>
          </div>
        </div>
      </Card>

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
                {brand.countries.length === 1 ? "1 country" : `${brand.countries.length} countries`}
              </h2>
              <div className="space-y-2">
                {brand.countries.map((c) => (
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
                {brand.links.map((link) => {
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

          {relatedBrands.length > 0 && (
            <Card>
              <CardContent>
                <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-4">
                  Related Operators
                </h2>
                <div>
                  {relatedBrands.map((b) => (
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
                        {b.countries.slice(0, 2).map((c) => (
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
        <h2>About {brand.name}</h2>
        <p>
          {brand.name} is a train operator serving{" "}
          {brand.countries.map((c) => COUNTRY_MAP[c]).join(", ")}. View trains operated by{" "}
          {brand.name} on Rail Radar, including real-time departures, arrivals, delays, and platform
          information. {brand.serviceTypes.map((t) => serviceTypeLabels[t] ?? t).join(", ")}{" "}
          services available.
        </p>
      </div>
    </div>
  );
}
