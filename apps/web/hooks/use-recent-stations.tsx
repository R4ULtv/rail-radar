"use client";

import * as React from "react";
import type { Station } from "@repo/data";

const RECENT_STATIONS_KEY = "recent-stations";
const MAX_RECENT_STATIONS = 3;

function saveRecentStations(stations: Station[]) {
  try {
    localStorage.setItem(RECENT_STATIONS_KEY, JSON.stringify(stations));
  } catch {
    // Ignore localStorage errors
  }
}

function loadRecentStations(): Station[] {
  try {
    const stored = localStorage.getItem(RECENT_STATIONS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || (parsed.length > 0 && typeof parsed[0] === "string")) {
      localStorage.removeItem(RECENT_STATIONS_KEY);
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

const RECENT_CHANGED_EVENT = "recent-stations-changed";

export function useRecentStations() {
  const [recentStations, setRecent] = React.useState<Station[]>([]);

  React.useEffect(() => {
    setRecent(loadRecentStations());

    const handleChange = () => {
      setRecent(loadRecentStations());
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

  const addRecentStation = React.useCallback((station: Station) => {
    const current = loadRecentStations();
    const updated = [station, ...current.filter((s) => s.id !== station.id)].slice(
      0,
      MAX_RECENT_STATIONS,
    );

    saveRecentStations(updated);
    setRecent(updated);
    window.dispatchEvent(new CustomEvent(RECENT_CHANGED_EVENT));
  }, []);

  return { recentStations, addRecentStation };
}
