"use client";

import { useState } from "react";
import type { Station } from "@repo/data";
import { Button } from "@repo/ui/components/button";
import { CheckIcon, CornerUpRightIcon, ShareIcon } from "lucide-react";
import { SaveButton } from "@/components/save-button";

export function StationActions({ station }: { station: Station }) {
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
    <div className="flex gap-1.5">
      <SaveButton
        station={station}
        size="icon-sm"
        variant="outline"
        className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted dark:border-border size-8 active:scale-[0.98]"
      />
      {station.geo && (
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleDirections}
          aria-label="Directions"
          className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted dark:border-border size-8 active:scale-[0.98]"
        >
          <CornerUpRightIcon className="size-4" />
        </Button>
      )}
      <Button
        variant="outline"
        size="icon-sm"
        onClick={handleShare}
        aria-label="Share"
        className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted dark:border-border size-8 active:scale-[0.98]"
      >
        {copied ? <CheckIcon className="size-4" /> : <ShareIcon className="size-4" />}
      </Button>
    </div>
  );
}
