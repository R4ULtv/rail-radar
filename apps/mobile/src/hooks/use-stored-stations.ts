import type { Station } from "@repo/data/types";
import { File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";

export const MAX_SAVED_STATIONS = 7;
const MAX_RECENT_STATIONS = 3;
const emptyStations: Station[] = [];

function isStoredStation(value: unknown): value is Station {
  if (typeof value !== "object" || value === null) return false;
  const station = value as Partial<Station>;
  return (
    typeof station.id === "string" &&
    typeof station.name === "string" &&
    typeof station.geo?.lat === "number" &&
    typeof station.geo?.lng === "number"
  );
}

/** Only the station itself, not extras like the popular list's visitor counts. */
function toStoredStation({ id, name, type, importance, geo }: Station): Station {
  return { id, name, type, importance, geo };
}

function createStationStore(fileName: string) {
  const file = new File(Paths.document, fileName);
  const listeners = new Set<() => void>();
  let stations: Station[] | null = null;

  function read(): Station[] {
    if (stations) return stations;
    try {
      const parsed: unknown = file.exists ? JSON.parse(file.textSync()) : [];
      stations = Array.isArray(parsed)
        ? parsed.filter(isStoredStation).map(toStoredStation)
        : emptyStations;
    } catch {
      stations = emptyStations;
    }
    return stations;
  }

  function write(next: Station[]) {
    stations = next;
    listeners.forEach((listener) => listener());
    try {
      if (!file.exists) file.create();
      file.write(JSON.stringify(next));
    } catch {
      // Keep the in-memory list; it will be retried on the next change.
    }
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { read, write, subscribe };
}

const savedStore = createStationStore("saved-stations.json");
const recentStore = createStationStore("recent-stations.json");

export function useSavedStations() {
  const savedStations = useSyncExternalStore(savedStore.subscribe, savedStore.read);

  return {
    savedStations,
    isSaved: (id: string) => savedStations.some((station) => station.id === id),
    isFull: savedStations.length >= MAX_SAVED_STATIONS,
    toggleSaved: (station: Station) => {
      const current = savedStore.read();
      if (current.some((saved) => saved.id === station.id)) {
        savedStore.write(current.filter((saved) => saved.id !== station.id));
      } else if (current.length < MAX_SAVED_STATIONS) {
        savedStore.write([toStoredStation(station), ...current]);
      }
    },
  };
}

export function useRecentStations() {
  return useSyncExternalStore(recentStore.subscribe, recentStore.read);
}

export function addRecentStation(station: Station) {
  const current = recentStore.read();
  recentStore.write(
    [toStoredStation(station), ...current.filter((recent) => recent.id !== station.id)].slice(
      0,
      MAX_RECENT_STATIONS,
    ),
  );
}
