import { useQuery } from "@tanstack/react-query";
import { getStationPhotos } from "@/lib/station-photos";

export function useStationPhotos(stationId: string, enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["station-photos", stationId],
    queryFn: () => getStationPhotos(stationId),
    enabled: enabled && typeof window !== "undefined",
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return data ?? [];
}
