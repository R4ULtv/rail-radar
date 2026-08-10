import { useQuery } from "@tanstack/react-query";
import { apiFetcher, buildApiUrl, endpoints, APIError } from "@/lib/api";
import type { TrainDataResponse } from "@/lib/api";

export function useTrainData(
  stationId: string | null,
  type: "arrivals" | "departures",
  enabled: boolean = true,
) {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ["station-trains", stationId, type],
    queryFn: () =>
      apiFetcher<TrainDataResponse>(buildApiUrl(endpoints.stationTrains(stationId!, type))),
    enabled: Boolean(stationId && enabled),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
    },
  );

  return {
    data: data?.trains ?? null,
    isLoading,
    isValidating: isFetching,
    error: error instanceof APIError ? error.message : (error?.message ?? null),
    lastUpdated: data?.timestamp ? new Date(data.timestamp) : null,
    info: data?.info ?? null,
  };
}
