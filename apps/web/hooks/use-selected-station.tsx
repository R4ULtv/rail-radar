"use client";

import * as React from "react";
import { useQueryState, parseAsInteger } from "nuqs";
import { useMap } from "react-map-gl/mapbox";
import { stationsCoords } from "@repo/data/stations";
import type { Station } from "@repo/data";
import { useSavedStations } from "./use-saved-stations";

interface SelectedStationContextValue {
  selectedStation: Station | null;
  selectStation: (station: Station) => void;
  clearStation: () => void;
  savedStations: Station[];
  isSaved: (stationId: number) => boolean;
  toggleSaved: (stationId: number) => void;
  maxSaved: number;
}

const SelectedStationContext =
  React.createContext<SelectedStationContextValue | null>(null);

export function SelectedStationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { current: map } = useMap();
  const [stationId, setStationId] = useQueryState(
    "station",
    parseAsInteger.withOptions({ history: "push", shallow: true }),
  );

  // Use the standalone saved stations hook
  const {
    savedStations,
    isSaved,
    toggleSaved,
    maxSaved,
  } = useSavedStations();

  const selectedStation = React.useMemo(() => {
    if (!stationId) return null;
    const station = stationsCoords.find((s) => s.id === stationId);
    return station ?? null;
  }, [stationId]);

  const selectStation = React.useCallback(
    (station: Station) => {
      // Use provided geo or look it up from stationsCoords
      const geo =
        station.geo ?? stationsCoords.find((s) => s.id === station.id)?.geo;
      if (!geo) return;

      setStationId(station.id);

      map?.flyTo({
        center: [geo.lng, geo.lat],
        zoom: 14,
      });
    },
    [map, setStationId],
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
    throw new Error(
      "useSelectedStation must be used within a SelectedStationProvider",
    );
  }
  return context;
}
