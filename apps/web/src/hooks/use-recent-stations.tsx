"use client";

import { useCallback } from "react";
import type { Station } from "@repo/data";
import { useStationStorage } from "./use-station-storage";

const MAX_RECENT_STATIONS = 3;

export function useRecentStations() {
  const {
    stations: recentStations,
    readStations,
    saveStations,
  } = useStationStorage("recent-stations", "recent-stations-changed");

  const addRecentStation = useCallback(
    (station: Station) => {
      const current = readStations();
      saveStations(
        [station, ...current.filter((s) => s.id !== station.id)].slice(0, MAX_RECENT_STATIONS),
      );
    },
    [readStations, saveStations],
  );

  return { recentStations, addRecentStation };
}
