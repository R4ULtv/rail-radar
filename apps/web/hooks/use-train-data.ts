import useSWR from "swr";
import type { Train } from "@repo/data";

interface TrainResponse {
  timestamp: string;
  info: string | null;
  trains: Train[];
}

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch train data");
    return res.json();
  });

export function useTrainData(
  stationId: number | null,
  type: "arrivals" | "departures",
  enabled: boolean = true,
) {
  const { data, error, isLoading, isValidating } = useSWR<TrainResponse>(
    stationId
      ? `${process.env.NEXT_PUBLIC_API_URL}/trains/${stationId}?type=${type}`
      : null,
    fetcher,
    {
      refreshInterval: enabled ? 10_000 : 0,
      revalidateOnFocus: true,
    },
  );

  return {
    data: data?.trains ?? null,
    isLoading,
    isValidating,
    error: error?.message ?? null,
    lastUpdated: data?.timestamp ? new Date(data.timestamp) : null,
    info: data?.info ?? null,
  };
}
