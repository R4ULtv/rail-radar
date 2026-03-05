import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { stations, stationById, getCountry, type Station } from "@repo/data";
import { Button } from "@repo/ui/components/button";
import { ArrowLeftIcon } from "lucide-react";
import { StaticMap } from "@/components/static-map";
import { StationHeader } from "@/components/station-page/station-header";
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

export async function generateStaticParams() {
  return stations
    .filter((s) => s.type === "rail" && s.geo && s.importance <= 2)
    .map((s) => ({ id: s.id }));
}
export const dynamicParams = true;
export const revalidate = false;

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

  const countryCode = getCountry(station.id)?.toUpperCase();
  const country = getCountry(station.id, { format: "name" });

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
      {/* Static map hero */}
      <div className="relative h-48 md:h-64 w-full">
        <StaticMap
          lat={station.geo.lat}
          lng={station.geo.lng}
          zoom={14}
          className="absolute inset-0"
        />
        <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-background rounded-md">
          <Button
            variant="outline"
            size="icon-sm"
            nativeButton={false}
            render={
              <Link
                href={`/?lat=${station.geo.lat}&lng=${station.geo.lng}&zoom=14&station=${station.id}`}
                aria-label="Back to map"
              >
                <ArrowLeftIcon className="size-4" />
              </Link>
            }
          />
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
