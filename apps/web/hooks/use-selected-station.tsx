"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryState, parseAsInteger } from "nuqs";
import { useMap } from "react-map-gl/maplibre";
import { stationsCoords } from "@repo/data/stations";
import type { Station } from "@repo/data";

const RECENT_STATIONS_KEY = "recent-stations";
const MAX_RECENT_STATIONS = 5;

function getRecentStations(): Station[] {
  try {
    const stored = localStorage.getItem(RECENT_STATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

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
  createContext<SelectedStationContextValue | null>(null);

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
  const [recentStations, setRecentStations] = useState<Station[]>([]);
  const hasFlownToInitial = useRef(false);

  // Derive selected station from URL parameter
  const selectedStation = useMemo(() => {
    if (!stationId) return null;
    const station = stationsCoords.find((s) => s.id === stationId);
    return station ? { id: station.id, name: station.name } : null;
  }, [stationId]);

  useEffect(() => {
    setRecentStations(getRecentStations());
  }, []);

  // Fly to station when loaded from URL (initial load only)
  useEffect(() => {
    if (!map || hasFlownToInitial.current) return;
    if (!stationId) return;

    const station = stationsCoords.find((s) => s.id === stationId);
    if (station?.geo) {
      map.flyTo({
        center: [station.geo.lng, station.geo.lat],
        zoom: 14,
      });
      hasFlownToInitial.current = true;
    }
  }, [map, stationId]);

  const selectStation = useCallback(
    (station: Station) => {
      const stationWithCoords = stationsCoords.find((s) => s.id === station.id);
      if (!stationWithCoords?.geo) return;

      const { lat, lng } = stationWithCoords.geo;

      setStationId(station.id);

      // Update recent stations
      setRecentStations((prev) => {
        const filtered = prev.filter((s) => s.id !== station.id);
        const updated = [
          { id: station.id, name: station.name },
          ...filtered,
        ].slice(0, MAX_RECENT_STATIONS);
        saveRecentStations(updated);
        return updated;
      });

      map?.flyTo({
        center: [lng, lat],
        zoom: 14,
      });
    },
    [map, setStationId],
  );

  const clearStation = useCallback(() => {
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
  const context = useContext(SelectedStationContext);
  if (!context) {
    throw new Error(
      "useSelectedStation must be used within a SelectedStationProvider",
    );
  }
  return context;
}
