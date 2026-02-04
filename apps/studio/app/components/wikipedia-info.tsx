"use client";

import {
  ExternalLinkIcon,
  BookOpenIcon,
  Loader2Icon,
  MapPinIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { useWikipediaStation } from "../hooks/use-wikipedia-station";
import {
  getStationStatus,
  calculateDistance,
  formatDistance,
} from "../lib/wikipedia-parser";
import type { StationInfobox, StationStatus } from "../types/wikipedia";

interface WikipediaInfoProps {
  stationName: string;
  currentCoordinates?: { lat: number; lng: number } | null;
  onUseCoordinates?: (lat: number, lng: number) => void;
}

export function WikipediaInfo({
  stationName,
  currentCoordinates,
  onUseCoordinates,
}: WikipediaInfoProps) {
  const { data, isLoading, error } = useWikipediaStation(stationName);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-3 text-sm text-muted-foreground">
        Failed to load Wikipedia data
      </div>
    );
  }

  if (!data) {
    const searchUrl = `https://it.wikipedia.org/w/index.php?search=${encodeURIComponent(`Stazione di ${stationName}`)}`;
    return (
      <div className="flex flex-col gap-2 py-2">
        <p className="text-sm text-muted-foreground">
          No Wikipedia article found
        </p>
        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-full",
          )}
        >
          <BookOpenIcon className="size-4" />
          Search on Wikipedia
        </a>
      </div>
    );
  }

  return (
    <WikipediaContent
      data={data}
      currentCoordinates={currentCoordinates}
      onUseCoordinates={onUseCoordinates}
    />
  );
}

function WikipediaContent({
  data,
  currentCoordinates,
  onUseCoordinates,
}: {
  data: StationInfobox;
  currentCoordinates?: { lat: number; lng: number } | null;
  onUseCoordinates?: (lat: number, lng: number) => void;
}) {
  const status = getStationStatus(data.stato);

  // Calculate distance if both coordinates are available
  const distance =
    data.coordinates && currentCoordinates
      ? calculateDistance(
          currentCoordinates.lat,
          currentCoordinates.lng,
          data.coordinates.lat,
          data.coordinates.lng,
        )
      : null;

  return (
    <div className="flex flex-col gap-3 py-2">
      {/* Status badge */}
      {data.stato && <StatusBadge status={status} label={data.stato} />}

      {/* Coordinates */}
      {data.coordinates && (
        <div className="rounded-md border border-border bg-muted/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <MapPinIcon className="size-4 text-muted-foreground" />
              <span className="font-mono text-xs">
                {data.coordinates.lat.toFixed(6)},{" "}
                {data.coordinates.lng.toFixed(6)}
              </span>
            </div>
            {onUseCoordinates && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onUseCoordinates(data.coordinates!.lat, data.coordinates!.lng)
                }
              >
                Use
              </Button>
            )}
          </div>
          {distance !== null && (
            <div className="mt-2 text-xs text-muted-foreground">
              {distance < 1 ? (
                <span className="text-green-600">Coordinates match</span>
              ) : (
                <span>
                  Distance from current:{" "}
                  <span
                    className={cn(
                      "font-medium",
                      distance > 1000 ? "text-amber-600" : "text-foreground",
                    )}
                  >
                    {formatDistance(distance)}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Wikipedia link */}
      {data.wikipediaUrl && (
        <a
          href={data.wikipediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-full",
          )}
        >
          <ExternalLinkIcon className="size-4" />
          View on Wikipedia
        </a>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: StationStatus;
  label: string;
}) {
  const statusColors: Record<StationStatus, string> = {
    attiva: "bg-green-500/20 text-green-700 border-green-500/30",
    soppressa: "bg-red-500/20 text-red-700 border-red-500/30",
    chiusa: "bg-red-500/20 text-red-700 border-red-500/30",
    unknown: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  };

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        statusColors[status],
      )}
    >
      {label}
    </span>
  );
}
