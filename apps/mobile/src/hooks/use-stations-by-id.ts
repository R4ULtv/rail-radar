import type { Station } from "@repo/data/types";
import { useEffect, useState } from "react";

import { loadStationsById } from "@/lib/stations";

/** The map's stations by ID, e.g. to name a line's stops; null while they load. */
export function useStationsById(stationsUrl: string | null) {
  const [loaded, setLoaded] = useState<{
    url: string;
    stations: Map<string, Station>;
  } | null>(null);

  useEffect(() => {
    if (!stationsUrl) return;
    let cancelled = false;
    loadStationsById(stationsUrl)
      .then((stations) => {
        if (!cancelled) setLoaded({ url: stationsUrl, stations });
      })
      .catch(() => {
        // Without stations, lines show no stops rather than loading forever.
        if (!cancelled) setLoaded({ url: stationsUrl, stations: new Map() });
      });
    return () => {
      cancelled = true;
    };
  }, [stationsUrl]);

  return loaded?.url === stationsUrl ? loaded.stations : null;
}
