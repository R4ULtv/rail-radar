import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import { useEffect, useState } from "react";

import { API_BASE_URL, USER_AGENT } from "@/lib/api";

// Stations ship with the app. Updates are downloaded in the background and used
// from the next launch; bigger changes (new countries) come with an app update.
const bundledStations = Asset.fromModule(require("@repo/data/stations.geojson"));
const downloadedStations = new File(Paths.document, "stations.geojson");
const downloadInfo = new File(Paths.document, "stations-download.json");
const refreshDelayMs = 30_000;
const refreshIntervalMs = 24 * 60 * 60 * 1000;

interface DownloadInfo {
  /** Hash of the bundled file the download replaces; a new app build resets it. */
  bundledHash: string;
  downloadedAt: number;
}

function readDownloadInfo(): DownloadInfo | null {
  try {
    if (!downloadInfo.exists) return null;
    const info = JSON.parse(downloadInfo.textSync()) as Partial<DownloadInfo>;
    return typeof info.bundledHash === "string" && typeof info.downloadedAt === "number"
      ? { bundledHash: info.bundledHash, downloadedAt: info.downloadedAt }
      : null;
  } catch {
    return null;
  }
}

async function downloadStations() {
  const temporary = new File(Paths.cache, "stations.download.geojson");
  await File.downloadFileAsync(`${API_BASE_URL}/stations.geojson`, temporary, {
    headers: { "User-Agent": USER_AGENT },
    idempotent: true,
  });
  if (temporary.size === 0) throw new Error("Downloaded stations are empty.");

  if (downloadedStations.exists) downloadedStations.delete();
  temporary.move(downloadedStations);

  if (!downloadInfo.exists) downloadInfo.create();
  downloadInfo.write(
    JSON.stringify({ bundledHash: bundledStations.hash, downloadedAt: Date.now() }),
  );
}

/** File URL of the station GeoJSON for the map source; null until it is ready. */
export function useStationsUrl() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const info = readDownloadInfo();
    const hasDownload = info?.bundledHash === bundledStations.hash && downloadedStations.exists;

    if (hasDownload) {
      setUrl(downloadedStations.uri);
    } else {
      bundledStations
        .downloadAsync()
        .then((asset) => {
          if (!cancelled && asset.localUri) setUrl(asset.localUri);
        })
        .catch(() => {
          // A bundled asset only fails to load in development without Metro.
        });
    }

    if (hasDownload && Date.now() - info.downloadedAt < refreshIntervalMs) {
      return () => {
        cancelled = true;
      };
    }

    const timeout = setTimeout(() => {
      downloadStations().catch(() => {
        // Keep the current stations; the next launch tries again.
      });
    }, refreshDelayMs);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  return url;
}
