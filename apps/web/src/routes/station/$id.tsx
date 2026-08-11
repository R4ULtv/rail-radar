import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { metadataToHead } from "@/lib/metadata";
import { loadStationPage } from "@/lib/station-data.functions";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { ArrowLeftIcon, ArrowRightIcon, MapIcon, SearchIcon } from "lucide-react";
import { staticAssetUrl } from "@/lib/static-assets";
import { useStationPhotos } from "@/hooks/use-station-photos";
import { StationGallery } from "@/components/station-page/station-gallery";
import { StationHeader } from "@/components/station-page/station-header";
import { StationActions } from "@/components/station-page/station-actions";
import { StationStats } from "@/components/station-page/station-stats";
import { NearbyStations } from "@/components/station-page/nearby-stations";
import { TrainBoard } from "@/components/station-page/train-board";
import { Skeleton } from "@repo/ui/components/skeleton";

export const Route = createFileRoute("/station/$id")({
  loader: async ({ params }) => {
    const data = await loadStationPage({ data: { id: params.id } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => metadataToHead(loaderData?.metadata ?? { title: "Station Not Found" }),
  pendingComponent: StationLoading,
  notFoundComponent: StationNotFound,
  component: StationRoute,
});

function StationRoute() {
  const data = Route.useLoaderData();
  return <StationPage {...data} />;
}

type StationPageData = NonNullable<Awaited<ReturnType<typeof loadStationPage>>>;

function StationPage({
  station,
  nearbyStations,
  code,
  countryCode,
  country,
  countrySlug,
}: StationPageData) {
  const stationPhotos = useStationPhotos(station.id, station.importance === 1);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TrainStation",
    name: station.name,
    url: `https://www.railradar24.com/station/${station.id}`,
    geo: {
      "@type": "GeoCoordinates",
      latitude: station.geo.lat,
      longitude: station.geo.lng,
    },
    address: {
      "@type": "PostalAddress",
      addressCountry: countryCode,
    },
    isAccessibleForFree: true,
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {/* Station media */}
      <div className="relative h-52 w-full md:h-72">
        <StationGallery
          stationName={station.name}
          lat={station.geo.lat}
          lng={station.geo.lng}
          photos={stationPhotos}
        />
        <Button
          variant="outline"
          size="icon-sm"
          nativeButton={false}
          className="absolute top-2 left-2 md:top-4 md:left-4 bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted dark:border-border size-8 active:scale-[0.98]"
          render={
            <Link
              to="/"
              search={{
                lat: station.geo.lat,
                lng: station.geo.lng,
                zoom: 14,
                station: station.id,
              }}
              aria-label="Back to map"
            >
              <ArrowLeftIcon className="size-4" />
            </Link>
          }
        />
        <div className="absolute top-2 right-2 md:hidden">
          <StationActions station={station} />
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto px-4 py-6 space-y-8 max-w-7xl">
        {/* Station header */}
        <StationHeader station={station} />

        {/* Stats and nearby stations row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StationStats stationId={station.id} />
          <NearbyStations stations={nearbyStations} />
        </div>
      </div>

      {/* Train board - edge-to-edge on mobile */}
      <div className="md:mx-auto md:px-4 md:pb-6 max-w-7xl">
        <TrainBoard stationId={station.id} />
      </div>

      {/* Discover more stations in the same country */}
      {countrySlug && country && (
        <div className="mx-auto px-3 md:px-4 pt-6 md:pt-0 pb-6 max-w-7xl">
          <Link to="/stations/$country" params={{ country: countrySlug }} className="group block">
            <Card
              size="sm"
              className="transition-[background-color,box-shadow,transform] lg:group-hover:bg-muted group-active:scale-[0.99]"
            >
              <CardContent className="flex items-center gap-3">
                {code && (
                  <img
                    src={staticAssetUrl(`/flags/${code}.svg`)}
                    alt={country}
                    width={40}
                    height={40}
                    className="size-10 shrink-0 rounded-full"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium tracking-tight lg:group-hover:text-foreground">
                    Discover more stations in {country}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Browse every train station across {country}
                  </div>
                </div>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out lg:group-hover:translate-x-0.5 lg:group-hover:text-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      <div className="sr-only">
        <h2>About {station.name}</h2>
        <p>
          {station.name} is a train station located in {country}. View real-time departures and
          arrivals, check live delay information, and find platform assignments. Train data is
          refreshed every 30 seconds so you always have the latest schedule. Use Rail Radar to plan
          your journey, find nearby stations, and get directions to {station.name}.
        </p>
      </div>
    </div>
  );
}

function StationLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Map hero placeholder */}
      <div className="relative h-52 md:h-72 w-full">
        <Skeleton className="absolute inset-0 rounded-none" />
        {/* Back button placeholder */}
        <div className="absolute top-2 left-2 md:top-4 md:left-4">
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto px-4 py-6 space-y-8 max-w-7xl">
        {/* Station header skeleton */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40 mt-2" />
            </div>
            <div className="flex gap-2 shrink-0">
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          </div>
        </div>

        {/* Stats and nearby stations row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stats skeleton */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-44" />
            </div>
          </div>

          {/* Nearby stations skeleton */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Train board skeleton - matches the real TrainBoard component */}
      <div className="md:mx-auto md:px-4 md:pb-6 max-w-7xl">
        {/* Mobile: single column with toggle in header */}
        <div className="md:hidden">
          <Card className="flex flex-col h-[500px] pt-4 pb-0 gap-4 rounded-none ring-0 shadow-none">
            <CardHeader className="px-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Skeleton className="size-4" />
                  <Skeleton className="h-5 w-24" />
                </CardTitle>
                <Skeleton className="h-7 w-32 rounded-md" />
              </div>
              <CardDescription>
                <Skeleton className="h-4 w-32" />
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 px-0 overflow-auto">
              <div>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Desktop: two columns side by side */}
        <div className="hidden md:grid grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, columnIndex) => (
            <Card
              key={columnIndex}
              className="flex flex-col h-[500px] py-4 gap-4 rounded-xl ring-1 shadow-xs"
            >
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Skeleton className="size-4" />
                  <Skeleton className="h-5 w-24" />
                </CardTitle>
                <CardDescription>
                  <Skeleton className="h-4 w-32" />
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 px-0 overflow-auto">
                <div>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 border-b">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="size-8 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function StationNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold">Station Not Found</h1>
          <p className="text-muted-foreground">
            We couldn&apos;t find a station with that ID. It may have been removed or the link might
            be incorrect.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button nativeButton={false} render={<Link to="/" />}>
            <MapIcon className="size-4" />
            Back to Map
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link to="/" />}>
            <SearchIcon className="size-4" />
            Search Stations
          </Button>
        </div>
      </div>
    </div>
  );
}
