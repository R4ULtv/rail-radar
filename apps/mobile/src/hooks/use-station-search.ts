import type { Station } from "@repo/data/types";
import { useEffect, useState } from "react";

import { fetchApi } from "@/lib/api";

const debounceMs = 250;
const minQueryLength = 2;

interface SearchState {
  query: string;
  stations: Station[];
  error: string | null;
  isLoading: boolean;
}

const idleState: SearchState = { query: "", stations: [], error: null, isLoading: false };

export function useStationSearch(input: string) {
  const query = input.trim();
  const isActive = query.length >= minQueryLength;
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<SearchState>(idleState);

  useEffect(() => {
    if (!isActive) {
      setState(idleState);
      return;
    }

    // Keep showing the previous results while the next query is typed.
    setState((current) => ({ ...current, error: null, isLoading: true }));

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await fetchApi(`/stations/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Stations could not be searched.");

        const stations = (await response.json()) as Station[];
        if (!Array.isArray(stations)) throw new Error("Search returned an invalid response.");

        setState({ query, stations, error: null, isLoading: false });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          query,
          stations: [],
          error: error instanceof Error ? error.message : "Stations could not be searched.",
          isLoading: false,
        });
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, isActive, retryCount]);

  return {
    ...state,
    isActive,
    hasResult: isActive && !state.isLoading && state.query === query,
    retry: () => setRetryCount((count) => count + 1),
  };
}
