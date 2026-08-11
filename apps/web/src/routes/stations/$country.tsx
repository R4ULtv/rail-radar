import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { metadataToHead } from "@/lib/metadata";
import { loadCountryStationsPage } from "@/lib/station-data.functions";
import { Card, CardContent } from "@repo/ui/components/card";
import { ArrowLeftIcon, ArrowRightIcon, ExpandIcon, TrainFrontIcon } from "lucide-react";
import baseUrl from "@/lib/base-url";
import { staticAssetUrl } from "@/lib/static-assets";
import { env } from "@/lib/env";

export const Route = createFileRoute("/stations/$country")({
  loader: async ({ params }) => {
    const data = await loadCountryStationsPage({ data: { slug: params.country } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => metadataToHead(loaderData?.metadata ?? { title: "Country Not Found" }),
  component: CountryRoute,
});

function CountryRoute() {
  const data = Route.useLoaderData();
  return <CountryStationsPage {...data} />;
}

type CountryStationsPageData = NonNullable<Awaited<ReturnType<typeof loadCountryStationsPage>>>;

function CountryStationsPage({
  slug,
  code,
  countryName,
  count,
  bounds,
  mapView,
  hubs,
  sections,
}: CountryStationsPageData) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Train Stations in ${countryName}`,
    url: new URL(`/stations/${slug}`, baseUrl).toString(),
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Stations",
          item: new URL("/stations", baseUrl).toString(),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: countryName,
          item: new URL(`/stations/${slug}`, baseUrl).toString(),
        },
      ],
    },
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
        to="/stations"
        className="group/back mb-8 md:mb-12 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 transition-transform duration-150 ease-out group-hover/back:-translate-x-0.5" />
        All countries
      </Link>

      <div className="mb-10 flex items-start gap-4">
        <img
          src={staticAssetUrl(`/flags/${code}.svg`)}
          alt={countryName}
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-full"
        />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Stations
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Train Stations in {countryName}
          </h1>
          <p className="mt-2 text-muted-foreground text-pretty">
            All {count.toLocaleString()} train stations in {countryName} with live departures and
            arrivals on Rail Radar.
          </p>
        </div>
      </div>

      {/* Static map hero, linked to the live map */}
      <Link
        to="/"
        search={{ lat: mapView.lat, lng: mapView.lng, zoom: mapView.zoom }}
        className="group/map"
      >
        <Card className="mb-12 overflow-hidden py-0">
          <div className="relative aspect-21/9">
            <img
              loading="eager"
              src={`${env.apiUrl}/map/static?bbox=${bounds.join(",")}&w=960&h=412`}
              alt={`Map of train stations in ${countryName}`}
              sizes="(max-width: 768px) calc(100vw - 32px), 848px"
              className="absolute inset-0 size-full object-cover"
            />
            <ExpandIcon className="absolute top-4 right-4 size-4 text-muted-foreground opacity-0 scale-95 transition-[transform,opacity] duration-200 ease-out group-hover/map:opacity-100 group-hover/map:scale-100" />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-card/40 to-transparent p-4 pt-8">
              <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Explore on the map
              </h2>
            </div>
          </div>
        </Card>
      </Link>

      {/* Major hubs */}
      {hubs.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold tracking-tight mb-5">Major stations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {hubs.map((station) => (
              <Link
                key={station.id}
                to="/station/$id"
                params={{ id: station.id }}
                className="group"
              >
                <Card
                  size="sm"
                  className="h-full transition-[background-color,box-shadow,transform] ease-[cubic-bezier(0.23,1,0.32,1)] duration-200 lg:group-hover:bg-muted/40 lg:group-hover:ring-foreground/20 group-active:scale-[0.98]"
                >
                  <CardContent className="flex items-center gap-3">
                    <TrainFrontIcon className="size-5 shrink-0 text-muted-foreground lg:group-hover:text-foreground" />
                    <div className="min-w-0 flex-1 text-sm font-medium tracking-tight truncate lg:group-hover:text-foreground">
                      {station.name}
                    </div>
                    <ArrowRightIcon className="size-3.5 text-muted-foreground opacity-0 -translate-x-1 transition-[opacity,transform] ease-[cubic-bezier(0.23,1,0.32,1)] duration-200 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Full A–Z index — plain anchors for crawlability and zero prefetch overhead */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-5">All stations</h2>

        <nav
          aria-label="Jump to letter"
          className="sticky top-0 z-10 -mx-4 mb-8 flex flex-wrap gap-1 bg-background/90 px-4 py-3 backdrop-blur md:mx-0 md:px-0"
        >
          {sections.map(({ letter }) => (
            <a
              key={letter}
              href={`#letter-${letter === "#" ? "0" : letter}`}
              className="flex size-7 items-center justify-center rounded-md text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {letter}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-10">
          {sections.map(({ letter, stations }) => (
            <div
              key={letter}
              id={`letter-${letter === "#" ? "0" : letter}`}
              className="scroll-mt-16"
            >
              <div className="mb-3 flex items-center gap-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{letter}</h3>
                <div className="h-px w-full bg-muted" />
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
                {stations.map((station) => (
                  <li key={station.id}>
                    <a
                      href={`/station/${station.id}`}
                      className="block truncate py-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {station.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="sr-only">
        <h2>Train stations in {countryName}</h2>
        <p>
          Rail Radar tracks {count.toLocaleString()} train stations across {countryName}. Select any
          station to view real-time departures and arrivals, live delay information, and platform
          assignments, refreshed every 30 seconds.
        </p>
      </div>
    </div>
  );
}
