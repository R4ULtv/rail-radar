import { useQuery } from "@tanstack/react-query";
import { apiFetcher, buildApiUrl, endpoints } from "@/lib/api";
import type { TrendingStationsResponse } from "@/lib/api";

/**
 * Hook for fetching trending stations
 * Auto-refreshes every 5 minutes to keep trending data current
 *
 * @param period - Time period for trending data (default: "week")
 * @returns Trending stations data, loading state, and error
 */
export function useTrendingStations(period: string = "week") {
  const { data, error, isLoading } = useQuery({
    queryKey: ["trending-stations", period],
    queryFn: () =>
      apiFetcher<TrendingStationsResponse>(buildApiUrl(endpoints.trendingStations(period))),
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    data,
    stations: data?.stations ?? [],
    error,
    isLoading,
  };
}
