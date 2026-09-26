import type { Station } from "@repo/data/types";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { loadStationSearch, type StationSearch } from "@/lib/stations";
import type { UserLocation } from "@/lib/user-location";

// Searching runs on the device, so it can start from the first character.
const minQueryLength = 1;
const resultLimit = 20;
const noStations: Station[] = [];

interface UseStationSearchOptions {
  /** The station GeoJSON to search; null until it is ready. */
  stationsUrl: string | null;
  /** Closer stations come first among ones that match the query equally well. */
  userLocation: UserLocation | null;
  /** Builds the search index before the first character, e.g. once the field is focused. */
  preload?: boolean;
}

export function useStationSearch(
  input: string,
  { stationsUrl, userLocation, preload = false }: UseStationSearchOptions,
) {
  const query = input.trim();
  const isActive = query.length >= minQueryLength;
  // Typing stays smooth: the results for a new query render in the background, and a render
  // that's still going when the next key is typed is dropped for the newer query.
  const deferredQuery = useDeferredValue(query);
  const [retryCount, setRetryCount] = useState(0);
  const [search, setSearch] = useState<StationSearch | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!(isActive || preload) || !stationsUrl) return;

    let cancelled = false;
    setError(null);
    loadStationSearch(stationsUrl)
      .then((loaded) => {
        if (!cancelled) setSearch(() => loaded);
      })
      .catch(() => {
        if (!cancelled) setError("Stations could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [isActive, preload, stationsUrl, retryCount]);

  // Null until a query has results. After that, the previous results stay on screen while the
  // next query renders.
  const results = useMemo<Station[] | null>(() => {
    if (!search || deferredQuery.length < minQueryLength) return null;
    return search(deferredQuery, { limit: resultLimit, near: userLocation });
  }, [search, deferredQuery, userLocation]);

  return {
    stations: (isActive && results) || noStations,
    error: isActive ? error : null,
    isActive,
    /** Whether `stations` holds results, possibly for the previous query while this one renders. */
    hasResult: isActive && results !== null,
    retry: () => setRetryCount((count) => count + 1),
  };
}
