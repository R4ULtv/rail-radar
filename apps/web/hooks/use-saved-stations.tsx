"use client";

import * as React from "react";
import { stationById } from "@repo/data/stations";
import type { Station } from "@repo/data";

const SAVED_STATIONS_KEY = "saved-stations";
export const MAX_SAVED_STATIONS = 10;

function saveSavedStationIds(ids: string[]) {
  try {
    localStorage.setItem(SAVED_STATIONS_KEY, JSON.stringify(ids));
  } catch {
    // Ignore localStorage errors
  }
}

function loadSavedStationIds(): string[] {
  try {
    const stored = localStorage.getItem(SAVED_STATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Custom event for cross-component sync
const SAVED_CHANGED_EVENT = "saved-stations-changed";

export function useSavedStations() {
  const [savedIds, setSavedIds] = React.useState<string[]>([]);

  // Derive full station objects from IDs
  const savedStations = React.useMemo(() => {
    return savedIds
      .map((id) => stationById.get(id))
      .filter((s): s is Station => s !== undefined);
  }, [savedIds]);

  // Load from localStorage after hydration and listen for changes
  React.useEffect(() => {
    // Initial load
    setSavedIds(loadSavedStationIds());

    const handleStorageChange = () => {
      setSavedIds(loadSavedStationIds());
    };

    // Listen for custom event (same-tab sync)
    window.addEventListener(SAVED_CHANGED_EVENT, handleStorageChange);
    // Listen for storage event (cross-tab sync)
    window.addEventListener("storage", (e) => {
      if (e.key === SAVED_STATIONS_KEY) {
        handleStorageChange();
      }
    });

    return () => {
      window.removeEventListener(SAVED_CHANGED_EVENT, handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const isSaved = React.useCallback(
    (stationId: string) => {
      return savedIds.includes(stationId);
    },
    [savedIds],
  );

  const toggleSaved = React.useCallback((stationId: string) => {
    const currentIds = loadSavedStationIds();
    const exists = currentIds.includes(stationId);
    let updated: string[];

    if (exists) {
      updated = currentIds.filter((id) => id !== stationId);
    } else {
      if (currentIds.length >= MAX_SAVED_STATIONS) {
        return;
      }
      updated = [stationId, ...currentIds];
    }

    saveSavedStationIds(updated);
    setSavedIds(updated);
    window.dispatchEvent(new CustomEvent(SAVED_CHANGED_EVENT));
  }, []);

  return {
    savedStations,
    isSaved,
    toggleSaved,
    maxSaved: MAX_SAVED_STATIONS,
  };
}
