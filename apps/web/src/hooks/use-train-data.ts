import { useQuery } from "@tanstack/react-query";
import { apiFetcher, buildApiUrl, endpoints, APIError } from "@/lib/api";
import type { TrainDataResponse } from "@/lib/api";

const REFRESH_INTERVAL_MS = 30_000;
const MIN_REFETCH_INTERVAL_MS = 1_000;

export function useTrainData(
  stationId: string | null,
  type: "arrivals" | "departures",
  enabled: boolean = true,
) {
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["station-trains", stationId, type],
    queryFn: ({ signal }) =>
      apiFetcher<TrainDataResponse>(buildApiUrl(endpoints.stationTrains(stationId!, type)), {
        signal,
        cache: "no-store",
      }),
    enabled: Boolean(stationId && enabled),
    // Check cached snapshots on mount/focus instead of treating receipt as a fresh update.
    staleTime: 0,
    refetchInterval: (query) => {
      if (query.state.fetchFailureCount > 0) {
        return REFRESH_INTERVAL_MS;
      }

      const timestamp = Date.parse(query.state.data?.timestamp ?? "");
      if (!Number.isFinite(timestamp)) {
        return REFRESH_INTERVAL_MS;
      }

      // A shared API snapshot may already be old when this browser receives it.
      const age = Math.max(0, Date.now() - timestamp);
      return Math.max(MIN_REFETCH_INTERVAL_MS, REFRESH_INTERVAL_MS - age);
    },
    refetchOnWindowFocus: true,
  });

  return {
    data: data?.trains ?? null,
    isLoading,
    isValidating: isFetching,
    error: error instanceof APIError ? error.message : (error?.message ?? null),
    lastUpdated: data?.timestamp ? new Date(data.timestamp) : null,
    info: data?.info ?? null,
    retry: () => {
      if (stationId && enabled) void refetch();
    },
  };
}
