import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { stations, type Station } from "@repo/data";
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
  const station = stations.find((s) => s.id === id);
  if (!station?.geo || station.type !== "rail") return null;
  return station as StationWithGeo;
}

export async function generateStaticParams() {
  return stations
    .filter((s) => s.type === "rail" && s.geo && s.importance <= 2)
    .map((s) => ({ id: s.id }));
}
export const dynamicParams = true;
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: StationPageProps): Promise<Metadata> {
  const { id } = await params;
  const station = getStation(id);

  if (!station) {
    return {
      title: "Station Not Found",
    };
  }

  return {
    title: station.name,
    description: `Live train departures and arrivals at ${station.name}. Real-time delays, platforms, and schedules.`,
    alternates: {
      canonical: `/station/${id}`,
    },
    openGraph: {
      title: `${station.name} | Rail Radar`,
      description: `Live train departures and arrivals at ${station.name}. Real-time delays, platforms, and schedules.`,
    },
  };
}

export default async function StationPage({ params }: StationPageProps) {
  const { id } = await params;
  const station = getStation(id);

  if (!station) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TrainStation",
    name: station.name,
    geo: {
      "@type": "GeoCoordinates",
      latitude: station.geo.lat,
      longitude: station.geo.lng,
    },
    address: {
      "@type": "PostalAddress",
      addressCountry: "IT",
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
    </div>
  );
}
