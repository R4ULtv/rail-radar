"use client";

import { useState } from "react";
import type { Station } from "@repo/data";
import { Button } from "@repo/ui/components/button";
import {
  CheckIcon,
  CornerUpRightIcon,
  MegaphoneIcon,
  ShareIcon,
} from "lucide-react";
import { SaveButton } from "@/components/save-button";

interface StationHeaderProps {
  station: Station;
  info?: string | null;
}

function formatDms(value: number, type: "lat" | "lng") {
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;

  const hemisphere =
    type === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";

  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = seconds.toFixed(1).padStart(4, "0");

  return `${degrees}°${paddedMinutes}'${paddedSeconds}"${hemisphere}`;
}

export function StationHeader({ station, info }: StationHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: station.name,
      text: `Check out ${station.name} on Rail Radar`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDirections = () => {
    if (!station.geo) return;

    const { lat, lng } = station.geo;
    const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

    const url = isApple
      ? `https://maps.apple.com/?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${lat},${lng}`;

    window.open(url, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {station.name}
          </h1>
          {station.geo && (
            <p className="text-sm text-muted-foreground mt-2 tabular-nums">
              {formatDms(station.geo.lat, "lat")}{" "}
              {formatDms(station.geo.lng, "lng")}
            </p>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <SaveButton station={station} size="icon-sm" />
          {station.geo && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDirections}
              aria-label="Directions"
            >
              <CornerUpRightIcon className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleShare}
            aria-label="Share"
          >
            {copied ? (
              <CheckIcon className="size-4" />
            ) : (
              <ShareIcon className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {info && (
        <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
          <MegaphoneIcon className="size-4 inline mr-2" />
          <span>{info}</span>
        </div>
      )}
    </div>
  );
}
