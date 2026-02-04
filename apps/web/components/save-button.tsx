"use client";

import { BookmarkIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import {
  useSavedStations,
  MAX_SAVED_STATIONS,
} from "@/hooks/use-saved-stations";
import { cn } from "@repo/ui/lib/utils";
import type { Station } from "@repo/data";

interface SaveButtonProps {
  station: Station;
  variant?: "ghost" | "outline";
  size?: "icon" | "icon-sm";
}

export function SaveButton({
  station,
  variant = "ghost",
  size = "icon",
}: SaveButtonProps) {
  const { isSaved, toggleSaved, savedStations } = useSavedStations();
  const saved = isSaved(station.id);
  const isAtLimit = !saved && savedStations.length >= MAX_SAVED_STATIONS;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => toggleSaved(station.id)}
      disabled={isAtLimit}
      aria-label={saved ? "Remove from saved" : "Save station"}
      title={
        isAtLimit ? `Maximum ${MAX_SAVED_STATIONS} saved stations reached` : undefined
      }
    >
      <BookmarkIcon
        className={cn(
          "size-4",
          saved && "fill-current"
        )}
      />
    </Button>
  );
}
