import useSWR from "swr";
import type { Train } from "@repo/data";

interface TrainResponse {
  trains: Train[];
  timestamp: string;
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
  const { data, error, isLoading } = useSWR<TrainResponse>(
    stationId
      ? `${process.env.NEXT_PUBLIC_API_URL}/trains/${stationId}?type=${type}`
      : null,
    fetcher,
    {
      refreshInterval: enabled ? 10_000 : 0,
      revalidateOnFocus: false,
    },
  );

  return {
    data: data?.trains ?? null,
    isLoading,
    error: error?.message ?? null,
    lastUpdated: data?.timestamp ? new Date(data.timestamp) : null,
  };
}
