"use client";

import { useCallback, useMemo } from "react";
import type { Station } from "@repo/data";
import { useStationStorage } from "./use-station-storage";

export const MAX_SAVED_STATIONS = 7;

export function useSavedStations() {
  const {
    stations: savedStations,
    readStations,
    saveStations,
  } = useStationStorage("saved-stations", "saved-stations-changed");
  const savedIds = useMemo(() => new Set(savedStations.map((s) => s.id)), [savedStations]);
  const isSaved = useCallback((stationId: string) => savedIds.has(stationId), [savedIds]);

  const toggleSaved = useCallback(
    (station: Station) => {
      const current = readStations();
      if (current.some((s) => s.id === station.id)) {
        saveStations(current.filter((s) => s.id !== station.id));
      } else if (current.length < MAX_SAVED_STATIONS) {
        saveStations([station, ...current]);
      }
    },
    [readStations, saveStations],
  );

  return { savedStations, isSaved, toggleSaved, maxSaved: MAX_SAVED_STATIONS };
}
