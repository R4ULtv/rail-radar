import useSWR from "swr";
import { apiFetcher, buildApiUrl, endpoints } from "@/lib/api";
import type { StationSearchResponse } from "@/lib/api";

/**
 * Hook for searching stations
 * Fetches station search results based on query string
 *
 * @param query - Search query (empty/null to disable fetching)
 * @returns Search results, loading state, and error
 */
export function useStationSearch(query: string | null) {
  const { data, error, isLoading } = useSWR<StationSearchResponse>(
    query ? buildApiUrl(endpoints.stationSearch(query)) : null,
    apiFetcher,
  );

  return {
    stations: data ?? [],
    error,
    isLoading,
  };
}
