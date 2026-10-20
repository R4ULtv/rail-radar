import type { Station } from "@repo/data/types";
import { useEffect, useState } from "react";
import { Linking } from "react-native";

import { getLine, type Line } from "@/lib/lines";
import { websiteLinkFromUrl, type WebsiteLink } from "@/lib/links";
import { loadStations } from "@/lib/stations";

// The link that launched the app is only opened once, not again if the map screen remounts.
let hasReadInitialUrl = false;

/**
 * Opens the station or line a shared website link points to, whether the link launched the app
 * or arrived while it was open. Other links are ignored.
 */
export function useWebsiteLinks(
  stationsUrl: string | null,
  onStation: (station: Station) => void,
  onLine: (line: Line) => void,
) {
  // A new object for every link, so opening the same link again opens it again.
  const [link, setLink] = useState<WebsiteLink | null>(null);

  useEffect(() => {
    const open = (url: string | null) => {
      const next = url ? websiteLinkFromUrl(url) : null;
      if (next) setLink(next);
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

  // Waits for the stations, which aren't ready yet when a link launches the app. A line's
  // camera fits its stops, so lines wait for them too.
  useEffect(() => {
    if (!link || !stationsUrl) return;

    if (link.type === "line") {
      setLink(null);
      // A line the app doesn't know yet, e.g. one newer than its data, is skipped.
      const line = getLine(link.id);
      if (line) onLine(line);
      return;
    }

    let cancelled = false;
    loadStations(stationsUrl)
      .then((stations) => {
        if (cancelled) return;
        setLink(null);
        // Likewise for a station newer than the app's stations.
        const station = stations.find(({ id }) => id === link.id);
        if (station) onStation(station);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [link, stationsUrl, onStation, onLine]);
}
