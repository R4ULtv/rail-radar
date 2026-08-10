import { useQuery } from "@tanstack/react-query";
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
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["station-search", query],
    queryFn: () =>
      apiFetcher<StationSearchResponse>(buildApiUrl(endpoints.stationSearch(query!))),
    enabled: Boolean(query),
    staleTime: 60_000,
  });

  return {
    stations: data ?? [],
    error,
    isLoading,
    retry: () => void refetch(),
  };
}
