"use client";

import { useState } from "react";
import Link from "next/link";
import type { Station } from "@repo/data";
import { Button } from "@repo/ui/components/button";
import {
  CheckIcon,
  CornerUpRightIcon,
  MapIcon,
  MegaphoneIcon,
  ShareIcon,
} from "lucide-react";

interface StationHeaderProps {
  station: Station;
  info?: string | null;
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

  const mapUrl = station.geo
    ? `/?station=${station.id}&lat=${station.geo.lat}&lng=${station.geo.lng}&zoom=14`
    : `/?station=${station.id}`;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {station.name}
          </h1>
          {station.geo && (
            <p className="text-sm text-muted-foreground mt-1 tabular-nums">
              {station.geo.lat.toFixed(5)}, {station.geo.lng.toFixed(5)}
            </p>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href={mapUrl} aria-label="Open on Map" />}
          >
            <MapIcon className="size-4" />
          </Button>
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
