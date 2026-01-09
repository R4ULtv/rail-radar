"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
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
  recentStations: Station[];
}

const SelectedStationContext = createContext<SelectedStationContextValue | null>(null);

export function SelectedStationProvider({ children }: { children: React.ReactNode }) {
  const { current: map } = useMap();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [recentStations, setRecentStations] = useState<Station[]>([]);

  useEffect(() => {
    setRecentStations(getRecentStations());
  }, []);

  const selectStation = useCallback(
    (station: Station) => {
      const stationWithCoords = stationsCoords.find((s) => s.id === station.id);
      if (!stationWithCoords?.geo) return;

      const { lat, lng } = stationWithCoords.geo;
      console.log(`Station: ${station.name}, Coordinates: [${lat}, ${lng}]`);

      setSelectedStation(station);

      // Update recent stations
      setRecentStations((prev) => {
        const filtered = prev.filter((s) => s.id !== station.id);
        const updated = [{ id: station.id, name: station.name }, ...filtered].slice(
          0,
          MAX_RECENT_STATIONS,
        );
        saveRecentStations(updated);
        return updated;
      });

      map?.flyTo({
        center: [lng, lat],
        zoom: 14,
      });
    },
    [map],
  );

  return (
    <SelectedStationContext.Provider value={{ selectedStation, selectStation, recentStations }}>
      {children}
    </SelectedStationContext.Provider>
  );
}

export function useSelectedStation() {
  const context = useContext(SelectedStationContext);
  if (!context) {
    throw new Error("useSelectedStation must be used within a SelectedStationProvider");
  }
  return context;
}
