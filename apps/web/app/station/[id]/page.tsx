import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { stationsCoords, type Station } from "@repo/data";
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
  // Ensure ID is purely numeric
  if (!/^\d+$/.test(id)) return null;
  const stationId = parseInt(id, 10);
  const station = stationsCoords.find((s) => s.id === stationId);
  // Only return stations with coordinates
  if (!station?.geo) return null;
  return station as StationWithGeo;
}

export async function generateStaticParams() {
  return [
    2416, // Roma Termini
    2385, // Roma Tiburtina
    2379, // Roma Ostiense
    1728, // Milano Centrale
    1720, // Milano Rogoredo
    1888, // Napoli Centrale
    4020, // Napoli Afragola
    683, // Bologna Centrale
    1325, // Firenze Santa Maria Novella
    2876, // Torino Porta Nuova
    2855, // Torino Lingotto
    3009, // Venezia S.Lucia
    3025, // Verona Porta Nuova
    245, // Genova Brignole
    257, // Genova Piazza Principe
    595, // Bari Centrale
    2018, // Palermo Centrale
    1032, // Catania Centrale
    1700, // Messina Centrale
    2156, // Pisa Centrale
    275, // La Spezia Centrale
    2925, // Trieste Centrale
    2922, // Treviso Centrale
  ].map((id) => ({ id: id.toString() }));
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

  return (
    <div className="min-h-screen bg-background">
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
          <NearbyStations
            currentStation={station}
            allStations={stationsCoords}
          />
        </div>
      </div>

      {/* Train board - edge-to-edge on mobile */}
      <div className="md:mx-auto md:px-4 md:pb-6 max-w-7xl">
        <TrainBoard stationId={station.id} />
      </div>
    </div>
  );
}
