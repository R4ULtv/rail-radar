import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getStationPhotos } from "@/lib/station-photos";

export function useStationPhotos(stationId: string, enabled: boolean) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data } = useQuery({
    queryKey: ["station-photos", stationId],
    queryFn: () => getStationPhotos(stationId),
    // Station pages are prerendered, but their R2 manifests are browser-only and load after
    // hydration. Keeping this false through the server render prevents build-time R2 reads.
    enabled: enabled && mounted,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return data ?? [];
}
