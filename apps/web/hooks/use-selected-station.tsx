"use client";

import * as React from "react";
import { useQueryState, parseAsInteger } from "nuqs";
import { useMap } from "react-map-gl/maplibre";
import { stationsCoords } from "@repo/data/stations";
import type { Station } from "@repo/data";

const RECENT_STATIONS_KEY = "recent-stations";
const MAX_RECENT_STATIONS = 5;

function saveRecentStations(stations: Station[]) {
  try {
    localStorage.setItem(RECENT_STATIONS_KEY, JSON.stringify(stations));
  } catch {
    // Ignore localStorage errors
  }
}

interface SelectedStationContextValue {
  selectedStation: Station | null;
  selectStation: (station: Station) => void;
  clearStation: () => void;
  recentStations: Station[];
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
  const [recentStations, setRecentStations] = React.useState<Station[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_STATIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

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

      // Update recent stations (store with geo for future use)
      setRecentStations((prev) => {
        const filtered = prev.filter((s) => s.id !== station.id);
        const updated = [{ ...station, geo }, ...filtered].slice(
          0,
          MAX_RECENT_STATIONS,
        );
        saveRecentStations(updated);
        return updated;
      });

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
      value={{ selectedStation, selectStation, clearStation, recentStations }}
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
