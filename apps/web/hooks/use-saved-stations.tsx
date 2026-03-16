"use client";

import * as React from "react";
import type { Station } from "@repo/data";

const SAVED_STATIONS_KEY = "saved-stations";
export const MAX_SAVED_STATIONS = 10;

function saveSavedStations(stations: Station[]) {
  try {
    localStorage.setItem(SAVED_STATIONS_KEY, JSON.stringify(stations));
  } catch {
    // Ignore localStorage errors
  }
}

function loadSavedStations(): Station[] {
  try {
    const stored = localStorage.getItem(SAVED_STATIONS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || (parsed.length > 0 && typeof parsed[0] === "string")) {
      localStorage.removeItem(SAVED_STATIONS_KEY);
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

// Custom event for cross-component sync
const SAVED_CHANGED_EVENT = "saved-stations-changed";

export function useSavedStations() {
  const [savedStations, setSaved] = React.useState<Station[]>([]);

  // Set for O(1) lookup
  const savedIdsSet = React.useMemo(() => new Set(savedStations.map((s) => s.id)), [savedStations]);

  // Load from localStorage after hydration and listen for changes
  React.useEffect(() => {
    setSaved(loadSavedStations());

    const handleStorageChange = () => {
      setSaved(loadSavedStations());
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === SAVED_STATIONS_KEY) {
        handleStorageChange();
      }
    };

    window.addEventListener(SAVED_CHANGED_EVENT, handleStorageChange);
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      window.removeEventListener(SAVED_CHANGED_EVENT, handleStorageChange);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  const isSaved = React.useCallback(
    (stationId: string) => savedIdsSet.has(stationId),
    [savedIdsSet],
  );

  const toggleSaved = React.useCallback((station: Station) => {
    const current = loadSavedStations();
    const exists = current.some((s) => s.id === station.id);
    let updated: Station[];

    if (exists) {
      updated = current.filter((s) => s.id !== station.id);
    } else {
      if (current.length >= MAX_SAVED_STATIONS) {
        return;
      }
      updated = [station, ...current];
    }

    saveSavedStations(updated);
    setSaved(updated);
    window.dispatchEvent(new CustomEvent(SAVED_CHANGED_EVENT));
  }, []);

  return {
    savedStations,
    isSaved,
    toggleSaved,
    maxSaved: MAX_SAVED_STATIONS,
  };
}
