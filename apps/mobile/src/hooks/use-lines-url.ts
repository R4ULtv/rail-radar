import { Asset } from "expo-asset";
import { useEffect, useState } from "react";

// Every line's track, simplified, written by metro.config.js. Unlike the stations, lines only
// change with an app update.
const bundledLines = Asset.fromModule(require("../../assets/generated/lines.geojson"));
let linesUrl: string | null = null;

/** File URL of the line tracks for the map source; null until it is ready. */
export function useLinesUrl() {
  const [url, setUrl] = useState(linesUrl);

  useEffect(() => {
    if (url) return;
    let cancelled = false;
    bundledLines
      .downloadAsync()
      .then((asset) => {
        linesUrl = asset.localUri;
        if (!cancelled && linesUrl) setUrl(linesUrl);
      })
      .catch(() => {
        // A bundled asset only fails to load in development without Metro.
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return url;
}
