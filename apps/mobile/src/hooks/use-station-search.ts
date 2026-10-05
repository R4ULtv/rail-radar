import type { Station } from "@repo/data/types";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useSearchLocation } from "@/hooks/use-search-location";
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
  /** Movement only refreshes ranking while the results can be seen. */
  visible: boolean;
  /** Builds the search index before the first character, e.g. once the field is focused. */
  preload?: boolean;
  /** Come first when they match, then the recent stations. */
  savedStations?: readonly Station[];
  recentStations?: readonly Station[];
}

export function useStationSearch(
  input: string,
  {
    stationsUrl,
    userLocation,
    visible,
    preload = false,
    savedStations = noStations,
    recentStations = noStations,
  }: UseStationSearchOptions,
) {
  const query = input.trim();
  const isActive = query.length >= minQueryLength;
  // Typing stays smooth: the results for a new query render in the background, and a render
  // that's still going when the next key is typed is dropped for the newer query.
  const deferredQuery = useDeferredValue(query);
  const searchLocation = useSearchLocation(userLocation, deferredQuery, visible);
  const [retryCount, setRetryCount] = useState(0);
  const [loadedSearch, setSearch] = useState<{ url: string; search: StationSearch } | null>(null);
  // A reset can switch the map's file while parsing/indexing is still in progress. Never
  // search the previous catalogue while the replacement prepares.
  const search = loadedSearch?.url === stationsUrl ? loadedSearch.search : null;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!(isActive || preload) || !stationsUrl) return;

    let cancelled = false;
    setError(null);
    loadStationSearch(stationsUrl)
      .then((loaded) => {
        if (!cancelled) setSearch({ url: stationsUrl, search: loaded });
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
    return search(deferredQuery, {
      limit: resultLimit,
      near: searchLocation,
      saved: savedStations,
      recent: recentStations,
    });
  }, [search, deferredQuery, searchLocation, savedStations, recentStations]);

  return {
    stations: (isActive && results) || noStations,
    error: isActive ? error : null,
    isActive,
    location: searchLocation,
    /** Whether `stations` holds results, possibly for the previous query while this one renders. */
    hasResult: isActive && results !== null,
    retry: () => setRetryCount((count) => count + 1),
  };
}
