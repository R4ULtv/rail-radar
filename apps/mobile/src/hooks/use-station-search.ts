import type { Station } from "@repo/data/types";
import { useEffect, useMemo, useState } from "react";

import { useDebounce } from "@/hooks/use-debounce";
import { loadStationSearch, type StationSearch } from "@/lib/station-search";
import type { UserLocation } from "@/lib/user-location";

// Searching runs on the device, so it can start from the first character.
const minQueryLength = 1;
const resultLimit = 20;
// Typing stays smooth: the list only re-renders once typing pauses.
const debounceMs = 150;

interface UseStationSearchOptions {
  /** The station GeoJSON to search; null until it is ready. */
  stationsUrl: string | null;
  /** Closer stations come first among ones that match the query equally well. */
  userLocation: UserLocation | null;
}

export function useStationSearch(
  input: string,
  { stationsUrl, userLocation }: UseStationSearchOptions,
) {
  const query = input.trim();
  const isActive = query.length >= minQueryLength;
  const debouncedQuery = useDebounce(query, debounceMs);
  const isDebouncing = debouncedQuery !== query;
  const [retryCount, setRetryCount] = useState(0);
  const [search, setSearch] = useState<StationSearch | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive || !stationsUrl) return;

    let cancelled = false;
    setError(null);
    loadStationSearch(stationsUrl)
      .then((loadedSearch) => {
        if (!cancelled) setSearch(() => loadedSearch);
      })
      .catch(() => {
        if (!cancelled) setError("Stations could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [isActive, stationsUrl, retryCount]);

  // Keeps showing the previous results while the next query is typed.
  const stations = useMemo<Station[]>(() => {
    if (!search) return [];
    if (debouncedQuery.length < minQueryLength) return [];
    return search(debouncedQuery, { limit: resultLimit, near: userLocation });
  }, [search, debouncedQuery, userLocation]);

  const isLoading = isActive && (!search || isDebouncing) && !error;

  return {
    stations: isActive ? stations : [],
    error: isActive ? error : null,
    isActive,
    isLoading,
    hasResult: isActive && search !== null && !isDebouncing,
    retry: () => setRetryCount((count) => count + 1),
  };
}
