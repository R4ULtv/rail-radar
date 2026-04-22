"use client";

import type { Station } from "@repo/data";
import {
  BookmarkIcon,
  CompassIcon,
  CopyIcon,
  CrosshairIcon,
  LocateFixedIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  RotateCwIcon,
} from "lucide-react";
import * as React from "react";
import { useMap } from "react-map-gl/mapbox";

import { useSelectedStation } from "@/hooks/use-selected-station";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@repo/ui/components/context-menu";

export interface MapContextMenuSnapshot {
  lat: number;
  lng: number;
  station: Station | null;
}

interface MapContextMenuProps {
  snapshot: MapContextMenuSnapshot | null;
  onLocate: () => void;
}

function formatCoordinates(snapshot: MapContextMenuSnapshot) {
  return `${snapshot.lat.toFixed(6)}, ${snapshot.lng.toFixed(6)}`;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function MapContextMenu({ snapshot, onLocate }: MapContextMenuProps) {
  const { current: map } = useMap();
  const { savedStations, isSaved, toggleSaved, maxSaved } = useSelectedStation();
  const station = snapshot?.station ?? null;
  const saved = station ? isSaved(station.id) : false;
  const isAtSavedLimit = !!station && !saved && savedStations.length >= maxSaved;

  const handleCopyCoordinates = React.useCallback(() => {
    if (!snapshot) return;
    copyText(formatCoordinates(snapshot));
  }, [snapshot]);

  const handleZoomIn = React.useCallback(() => {
    if (!map || !snapshot) return;
    map.easeTo({
      zoom: map.getZoom() + 1,
      around: [snapshot.lng, snapshot.lat],
      duration: 300,
    });
  }, [map, snapshot]);

  const handleZoomOut = React.useCallback(() => {
    if (!map || !snapshot) return;
    map.easeTo({
      zoom: map.getZoom() - 1,
      around: [snapshot.lng, snapshot.lat],
      duration: 300,
    });
  }, [map, snapshot]);

  const handleCenterHere = React.useCallback(() => {
    if (!map || !snapshot) return;
    map.easeTo({
      center: [snapshot.lng, snapshot.lat],
      zoom: map.getZoom(),
      duration: 500,
    });
  }, [map, snapshot]);

  const handleResetBearing = React.useCallback(() => {
    if (!map || !snapshot) return;
    map.easeTo({
      bearing: 0,
      pitch: 0,
      around: [snapshot.lng, snapshot.lat],
      duration: 300,
    });
  }, [map, snapshot]);

  const handleRotateLeft = React.useCallback(() => {
    if (!map || !snapshot) return;
    map.easeTo({
      bearing: map.getBearing() - 15,
      pitch: 0,
      around: [snapshot.lng, snapshot.lat],
      duration: 300,
    });
  }, [map, snapshot]);

  const handleRotateRight = React.useCallback(() => {
    if (!map || !snapshot) return;
    map.easeTo({
      bearing: map.getBearing() + 15,
      pitch: 0,
      around: [snapshot.lng, snapshot.lat],
      duration: 300,
    });
  }, [map, snapshot]);

  const handleCopyStationId = React.useCallback(() => {
    if (!station) return;
    copyText(station.id);
  }, [station]);

  const handleToggleSaved = React.useCallback(() => {
    if (!station || isAtSavedLimit) return;
    toggleSaved(station);
  }, [isAtSavedLimit, station, toggleSaved]);

  return (
    <ContextMenuContent className="min-w-48">
      <ContextMenuItem disabled={!snapshot} onClick={handleCopyCoordinates}>
        <CopyIcon />
        Copy coordinates
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem disabled={!snapshot} onClick={handleZoomIn}>
        <PlusIcon />
        Zoom in
        <ContextMenuShortcut>+</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={!snapshot} onClick={handleZoomOut}>
        <MinusIcon />
        Zoom out
        <ContextMenuShortcut>-</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger className="gap-2">
          <CompassIcon />
          Bearing
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem disabled={!snapshot} onClick={handleResetBearing}>
            <CompassIcon className="-rotate-45" />
            Reset
            <ContextMenuShortcut>N</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem disabled={!snapshot} onClick={handleRotateLeft}>
            <RotateCcwIcon />
            15° left
            <ContextMenuShortcut>⇧←</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem disabled={!snapshot} onClick={handleRotateRight}>
            <RotateCwIcon />
            15° right
            <ContextMenuShortcut>⇧→</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem disabled={!snapshot} onClick={handleCenterHere}>
        <CrosshairIcon />
        Center here
      </ContextMenuItem>
      <ContextMenuItem onClick={onLocate}>
        <LocateFixedIcon />
        Locate me
        <ContextMenuShortcut>L</ContextMenuShortcut>
      </ContextMenuItem>
      {station && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCopyStationId}>
            <CopyIcon />
            Copy station ID
          </ContextMenuItem>
          <ContextMenuItem
            disabled={isAtSavedLimit}
            onClick={handleToggleSaved}
            title={isAtSavedLimit ? `Maximum ${maxSaved} saved stations reached` : undefined}
          >
            <BookmarkIcon className={saved ? "fill-current" : undefined} />
            {saved ? "Unsave station" : "Save station"}
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
