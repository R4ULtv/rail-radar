import { useQuery } from "@tanstack/react-query";
import { apiFetcher, buildApiUrl, endpoints } from "@/lib/api";
import type { StationStatsResponse } from "@/lib/api";

/**
 * Hook for fetching station statistics
 * Fetches visit and trending data for a specific station
 *
 * @param stationId - Station ID to fetch stats for
 * @param period - Time period for stats (default: "week")
 * @returns Station statistics data, loading state, and error
 */
export function useStationStats(stationId: string, period: string = "week") {
  const { data, error, isLoading } = useQuery({
    queryKey: ["station-stats", stationId, period],
    queryFn: () =>
      apiFetcher<StationStatsResponse>(buildApiUrl(endpoints.stationStats(stationId, period))),
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    data,
    error,
    isLoading,
  };
}
