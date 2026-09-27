import type { Station } from "@repo/data/types";
import { useEffect, useState } from "react";
import { Linking } from "react-native";

import { stationIdFromUrl } from "@/lib/links";
import { loadStations } from "@/lib/stations";

// The link that launched the app is only opened once, not again if the map screen remounts.
let hasReadInitialUrl = false;

/**
 * Opens the station a shared website link points to, whether the link launched the app or
 * arrived while it was open. Other links are ignored.
 */
export function useStationLinks(stationsUrl: string | null, onStation: (station: Station) => void) {
  // An object, so opening the same link again opens the station again.
  const [link, setLink] = useState<{ stationId: string } | null>(null);

  useEffect(() => {
    const open = (url: string | null) => {
      const stationId = url ? stationIdFromUrl(url) : null;
      if (stationId) setLink({ stationId });
    };

    if (!hasReadInitialUrl) {
      hasReadInitialUrl = true;
      Linking.getInitialURL()
        .then(open)
        .catch(() => {});
    }
    const subscription = Linking.addEventListener("url", ({ url }) => open(url));
    return () => subscription.remove();
  }, []);

  // Waits for the stations, which aren't ready yet when a link launches the app.
  useEffect(() => {
    if (!link || !stationsUrl) return;
    let cancelled = false;

    loadStations(stationsUrl)
      .then((stations) => {
        if (cancelled) return;
        setLink(null);
        // A station the app doesn't know yet, e.g. one newer than its stations, is skipped.
        const station = stations.find(({ id }) => id === link.stationId);
        if (station) onStation(station);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [link, stationsUrl, onStation]);
}
