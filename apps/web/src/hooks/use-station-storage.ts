import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Station } from "@repo/data";

const getServerSnapshot = () => null;

function parseStations(stored: string | null): Station[] {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    // Older storage formats contained IDs or stations without coordinates.
    return parsed.filter(
      (station): station is Station =>
        station != null &&
        typeof station === "object" &&
        typeof station.id === "string" &&
        typeof station.geo?.lat === "number" &&
        typeof station.geo?.lng === "number",
    );
  } catch {
    return [];
  }
}

/** Subscribe to browser storage while keeping the server and hydration snapshots empty. */
export function useStationStorage(key: string, changeEvent: string) {
  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) onChange();
      };
      window.addEventListener(changeEvent, onChange);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(changeEvent, onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key, changeEvent],
  );

  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const stations = useMemo(() => parseStations(stored), [stored]);
  const readStations = useCallback(() => parseStations(getSnapshot()), [getSnapshot]);
  const saveStations = useCallback(
    (updated: Station[]) => {
      try {
        localStorage.setItem(key, JSON.stringify(updated));
      } catch {
        // Storage can be unavailable or full.
      }
      window.dispatchEvent(new Event(changeEvent));
    },
    [key, changeEvent],
  );

  return { stations, readStations, saveStations };
}
