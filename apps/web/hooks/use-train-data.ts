import useSWR from "swr";
import { apiFetcher, buildApiUrl, endpoints, APIError } from "@/lib/api";
import type { TrainDataResponse } from "@/lib/api";

export function useTrainData(
  stationId: string | null,
  type: "arrivals" | "departures",
  enabled: boolean = true,
) {
  const { data, error, isLoading, isValidating } = useSWR<TrainDataResponse>(
    stationId && enabled
      ? buildApiUrl(endpoints.stationTrains(stationId, type))
      : null,
    apiFetcher,
    {
      refreshInterval: 10_000,
      revalidateOnFocus: true,
    },
  );

  return {
    data: data?.trains ?? null,
    isLoading,
    isValidating,
    error: error instanceof APIError ? error.message : (error?.message ?? null),
    lastUpdated: data?.timestamp ? new Date(data.timestamp) : null,
    info: data?.info ?? null,
  };
}
