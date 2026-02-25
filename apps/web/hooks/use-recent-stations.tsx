"use client";

import * as React from "react";
import { stationById } from "@repo/data/stations";
import type { Station } from "@repo/data";

const RECENT_STATIONS_KEY = "recent-stations";
const MAX_RECENT_STATIONS = 3;

function saveRecentStationIds(ids: string[]) {
  try {
    localStorage.setItem(RECENT_STATIONS_KEY, JSON.stringify(ids));
  } catch {
    // Ignore localStorage errors
  }
}

function loadRecentStationIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_STATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

const RECENT_CHANGED_EVENT = "recent-stations-changed";

export function useRecentStations() {
  const [recentIds, setRecentIds] = React.useState<string[]>([]);

  const recentStations = React.useMemo(() => {
    return recentIds.map((id) => stationById.get(id)).filter((s): s is Station => s !== undefined);
  }, [recentIds]);

  React.useEffect(() => {
    setRecentIds(loadRecentStationIds());

    const handleChange = () => {
      setRecentIds(loadRecentStationIds());
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === RECENT_STATIONS_KEY) {
        handleChange();
      }
    };

    window.addEventListener(RECENT_CHANGED_EVENT, handleChange);
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      window.removeEventListener(RECENT_CHANGED_EVENT, handleChange);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  const addRecentStation = React.useCallback((stationId: string) => {
    const currentIds = loadRecentStationIds();
    const updated = [stationId, ...currentIds.filter((id) => id !== stationId)].slice(
      0,
      MAX_RECENT_STATIONS,
    );

    saveRecentStationIds(updated);
    setRecentIds(updated);
    window.dispatchEvent(new CustomEvent(RECENT_CHANGED_EVENT));
  }, []);

  return { recentStations, addRecentStation };
}
