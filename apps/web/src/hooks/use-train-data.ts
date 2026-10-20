import { useQuery } from "@tanstack/react-query";
import { apiFetcher, buildApiUrl, endpoints, APIError } from "@/lib/api";
import type { TrainDataResponse } from "@/lib/api";
import { isApiRateLimitActive } from "@/lib/api/error";
import { getTrainRefetchInterval } from "@/lib/train-refresh";

export function useTrainData(
  stationId: string | null,
  type: "arrivals" | "departures",
  enabled: boolean = true,
) {
  const { data, error, errorUpdatedAt, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["station-trains", stationId, type],
    queryFn: ({ signal }) =>
      apiFetcher<TrainDataResponse>(buildApiUrl(endpoints.stationTrains(stationId!, type)), {
        signal,
        cache: "no-store",
      }),
    enabled: Boolean(stationId && enabled),
    // Check cached snapshots on mount/focus instead of treating receipt as a fresh update.
    staleTime: 0,
    refetchInterval: (query) =>
      getTrainRefetchInterval({
        timestamp: query.state.data?.timestamp,
        hasError: query.state.fetchFailureCount > 0 || query.state.error !== null,
        retryAfterMs:
          query.state.error instanceof APIError ? query.state.error.retryAfterMs : undefined,
      }),
    refetchOnWindowFocus: (query) =>
      !isApiRateLimitActive(query.state.error, query.state.errorUpdatedAt),
    refetchOnReconnect: (query) =>
      !isApiRateLimitActive(query.state.error, query.state.errorUpdatedAt),
    retryOnMount: false,
    refetchOnMount: (query) => !isApiRateLimitActive(query.state.error, query.state.errorUpdatedAt),
  });

  return {
    data: data?.trains ?? null,
    isLoading,
    isValidating: isFetching,
    error: error instanceof APIError ? error.message : (error?.message ?? null),
    lastUpdated: data?.timestamp ? new Date(data.timestamp) : null,
    info: data?.info ?? null,
    retry: () => {
      if (stationId && enabled && !isApiRateLimitActive(error, errorUpdatedAt)) void refetch();
    },
  };
}
