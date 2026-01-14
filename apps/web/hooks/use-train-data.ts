import useSWR from "swr";
import type { Train } from "@repo/data";

interface TrainResponse {
  timestamp: string;
  info: string | null;
  trains: Train[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    // Try to parse error message from API response
    try {
      const errorData = await res.json();
      if (errorData.error) {
        throw new Error(errorData.error);
      }
    } catch (e) {
      // If there's an error message, use it; otherwise generic
      if (e instanceof Error && e.message) {
        throw e;
      }
    }
    // Fallback generic error
    throw new Error("Unable to load train data");
  }

  return res.json();
};

export function useTrainData(
  stationId: number | null,
  type: "arrivals" | "departures",
  enabled: boolean = true,
) {
  const { data, error, isLoading, isValidating } = useSWR<TrainResponse>(
    stationId
      ? `${process.env.NEXT_PUBLIC_API_URL}/stations/${stationId}?type=${type}`
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
