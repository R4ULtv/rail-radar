import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { stations, stationById } from "@repo/data/stations";
import { getCountry, getCountrySlug } from "@repo/data/countries";
import type { Station } from "@repo/data";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { staticAssetUrl } from "@/lib/static-assets";
import { getStationPhotos } from "@/lib/station-photos";
import { StationGallery } from "@/components/station-page/station-gallery";
import { StationHeader } from "@/components/station-page/station-header";
import { StationActions } from "@/components/station-page/station-actions";
import { StationStats } from "@/components/station-page/station-stats";
import { NearbyStations } from "@/components/station-page/nearby-stations";
import { TrainBoard } from "@/components/station-page/train-board";

interface StationPageProps {
  params: Promise<{ id: string }>;
}

type StationWithGeo = Station & { geo: { lat: number; lng: number } };

function getStation(id: string): StationWithGeo | null {
  const station = stationById.get(id);
  if (!station?.geo || station.type !== "rail") return null;
  return station as StationWithGeo;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: StationPageProps): Promise<Metadata> {
  const { id } = await params;
  const station = getStation(id);

  if (!station) {
    return {
      title: "Station Not Found",
    };
  }

  const country = getCountry(id, { format: "name" });
  const description = `Live train departures and arrivals at ${station.name}, ${country}. Check real-time delays, platform numbers, and schedules updated every 30 seconds.`;

  return {
    title: `${station.name} - Live Departures & Arrivals`,
    description,
    alternates: {
      canonical: `/station/${id}`,
    },
    openGraph: {
      title: `${station.name} - Live Departures & Arrivals | Rail Radar`,
      description,
      images: [
        {
          url: `/og?id=${id}`,
          width: 1200,
          height: 630,
          alt: `${station.name} station map`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${station.name} - Live Departures & Arrivals | Rail Radar`,
      description,
      images: [`/og?id=${id}`],
    },
  };
}

export default async function StationPage({ params }: StationPageProps) {
  const { id } = await params;
  const station = getStation(id);

  if (!station) {
    notFound();
  }

  const code = getCountry(station.id);
  const countryCode = code?.toUpperCase();
  const country = getCountry(station.id, { format: "name" });
  const countrySlug = code ? getCountrySlug(code) : null;
  const stationPhotos = station.importance === 1 ? await getStationPhotos(station.id) : [];

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
              href={`/?lat=${station.geo.lat}&lng=${station.geo.lng}&zoom=14&station=${station.id}`}
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
          <NearbyStations currentStation={station} allStations={stations} />
        </div>
      </div>

      {/* Train board - edge-to-edge on mobile */}
      <div className="md:mx-auto md:px-4 md:pb-6 max-w-7xl">
        <TrainBoard stationId={station.id} />
      </div>

      {/* Discover more stations in the same country */}
      {countrySlug && country && (
        <div className="mx-auto px-3 md:px-4 pt-6 md:pt-0 pb-6 max-w-7xl">
          <Link href={`/stations/${countrySlug}`} className="group block">
            <Card
              size="sm"
              className="transition-[background-color,box-shadow,transform] lg:group-hover:bg-muted group-active:scale-[0.99]"
            >
              <CardContent className="flex items-center gap-3">
                {code && (
                  <Image
                    unoptimized
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
