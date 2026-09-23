import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetcher, buildApiUrl, endpoints } from "@/lib/api";
import type { StationSearchResponse } from "@/lib/api";

type SearchData = { query: string; stations: StationSearchResponse };

const EMPTY_STATIONS: StationSearchResponse = [];

/**
 * Hook for searching stations
 * Fetches station search results based on query string
 *
 * @param query - Search query (empty/null to disable fetching)
 * @returns Search results, loading state, and error
 */
export function useStationSearch(query: string | null) {
  const result = useQuery<SearchData>({
    queryKey: ["station-search", query],
    queryFn: async ({ signal }) => {
      const requestedQuery = query!;
      return {
        query: requestedQuery,
        stations: await apiFetcher<StationSearchResponse>(
          buildApiUrl(endpoints.stationSearch(requestedQuery)),
          { signal },
        ),
      };
    },
    enabled: Boolean(query),
    staleTime: 60_000,
    placeholderData: query ? keepPreviousData : undefined,
  });

  return {
    stations: query ? (result.data?.stations ?? EMPTY_STATIONS) : EMPTY_STATIONS,
    displayedQuery: query ? (result.data?.query ?? null) : null,
    isPlaceholderData: result.isPlaceholderData,
    isFetching: result.isFetching,
    error: result.error,
    isLoading: result.isLoading,
    retry: () => void result.refetch(),
  };
}
