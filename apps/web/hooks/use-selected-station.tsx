"use client";

import * as React from "react";
import { useQueryState, parseAsString } from "nuqs";
import { useMap } from "react-map-gl/mapbox";
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
  toggleSaved: (station: Station) => void;
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

  const { savedStations, isSaved, toggleSaved, maxSaved } = useSavedStations();
  const { recentStations, addRecentStation } = useRecentStations();

  const [stationObject, setStationObject] = React.useState<Station | null>(null);

  const stationRef = React.useRef<Station | null>(null);

  const flyToRef = React.useRef((_geo: { lat: number; lng: number }, _type: string) => {});
  React.useEffect(() => {
    flyToRef.current = (geo, type) => {
      map?.flyTo({
        center: [geo.lng, geo.lat],
        zoom: type === "rail" ? 14 : 15,
        padding: isMobile ? { bottom: 250, top: 0, left: 0, right: 0 } : undefined,
      });
    };
  }, [map, isMobile]);

  // Clear stale ?station= param on page load (no data to resolve without a fetch)
  React.useEffect(() => {
    if (stationId && !stationRef.current) {
      setStationId(null);
    }
  }, [stationId, setStationId]);

  const selectStation = React.useCallback(
    (station: Station) => {
      if (station.type === "rail") {
        stationRef.current = station;
        setStationObject(station);
        setStationId(station.id);
        addRecentStation(station);
      }

      if (station.geo) {
        flyToRef.current(station.geo, station.type);
      }
    },
    [setStationId, addRecentStation],
  );

  const clearStation = React.useCallback(() => {
    stationRef.current = null;
    setStationId(null);
    setStationObject(null);
  }, [setStationId]);

  return (
    <SelectedStationContext.Provider
      value={{
        selectedStation: stationObject,
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
  const context = React.use(SelectedStationContext);
  if (!context) {
    throw new Error("useSelectedStation must be used within a SelectedStationProvider");
  }
  return context;
}
