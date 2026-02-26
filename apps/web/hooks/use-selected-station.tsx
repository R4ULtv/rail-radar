"use client";

import * as React from "react";
import { useQueryState, parseAsString } from "nuqs";
import { useMap } from "react-map-gl/mapbox";
import { stationById } from "@repo/data/stations";
import type { Station } from "@repo/data";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { useSavedStations } from "./use-saved-stations";
import { useRecentStations } from "./use-recent-stations";

interface SelectedStationContextValue {
  selectedStation: Station | null;
  selectStation: (station: Station) => void;
  clearStation: () => void;
  savedStations: Station[];
  recentStations: Station[];
  isSaved: (stationId: string) => boolean;
  toggleSaved: (stationId: string) => void;
  maxSaved: number;
}

const SelectedStationContext = React.createContext<SelectedStationContextValue | null>(null);

export function SelectedStationProvider({ children }: { children: React.ReactNode }) {
  const { current: map } = useMap();
  const [stationId, setStationId] = useQueryState(
    "station",
    parseAsString.withOptions({ history: "push", shallow: true }),
  );

  const isMobile = useIsMobile();

  // Use the standalone saved stations hook
  const { savedStations, isSaved, toggleSaved, maxSaved } = useSavedStations();
  const { recentStations, addRecentStation } = useRecentStations();

  const selectedStation = React.useMemo(() => {
    if (!stationId) return null;
    return stationById.get(stationId) ?? null;
  }, [stationId]);

  const selectStation = React.useCallback(
    (station: Station) => {
      // Use provided geo or look it up from stationById
      const geo = station.geo ?? stationById.get(station.id)?.geo;
      if (!geo) return;

      if (station.type === "rail") {
        setStationId(station.id);
        addRecentStation(station.id);
      }

      map?.flyTo({
        center: [geo.lng, geo.lat],
        zoom: station.type === "rail" ? 14 : 15,
        padding: isMobile ? { bottom: 250, top: 0, left: 0, right: 0 } : undefined,
      });
    },
    [map, isMobile, setStationId, addRecentStation],
  );

  const clearStation = React.useCallback(() => {
    setStationId(null);
  }, [setStationId]);

  return (
    <SelectedStationContext.Provider
      value={{
        selectedStation,
        selectStation,
        clearStation,
        savedStations,
        recentStations,
        isSaved,
        toggleSaved,
        maxSaved,
      }}
    >
      {children}
    </SelectedStationContext.Provider>
  );
}

export function useSelectedStation() {
  const context = React.useContext(SelectedStationContext);
  if (!context) {
    throw new Error("useSelectedStation must be used within a SelectedStationProvider");
  }
  return context;
}
