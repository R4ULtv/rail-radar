import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import { useEffect, useState, useSyncExternalStore } from "react";

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

function readCurrentDownload() {
  const info = readDownloadInfo();
  return info?.bundledHash === bundledStations.hash && downloadedStations.exists ? info : null;
}

// The download in use for this launch, or null while the bundled stations are.
let currentDownload = readCurrentDownload();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** When the stations in use were downloaded, or null for the ones bundled with the app. */
export function useStationsDownloadedAt() {
  return useSyncExternalStore(subscribe, () => currentDownload)?.downloadedAt ?? null;
}

/**
 * Goes back to the bundled stations, e.g. if a download is broken. The map switches right away
 * and a fresh copy is downloaded on the next launch.
 */
export function resetStations() {
  try {
    if (downloadedStations.exists) downloadedStations.delete();
    if (downloadInfo.exists) downloadInfo.delete();
  } finally {
    currentDownload = null;
    listeners.forEach((listener) => listener());
  }
}

/** File URL of the station GeoJSON for the map source; null until it is ready. */
export function useStationsUrl() {
  const hasDownload = useSyncExternalStore(subscribe, () => currentDownload) !== null;
  const [bundledUrl, setBundledUrl] = useState<string | null>(null);

  useEffect(() => {
    if (hasDownload) return;
    let cancelled = false;
    bundledStations
      .downloadAsync()
      .then((asset) => {
        if (!cancelled && asset.localUri) setBundledUrl(asset.localUri);
      })
      .catch(() => {
        // A bundled asset only fails to load in development without Metro.
      });
    return () => {
      cancelled = true;
    };
  }, [hasDownload]);

  // Once per launch; a reset in the meantime waits for the next one.
  useEffect(() => {
    if (currentDownload && Date.now() - currentDownload.downloadedAt < refreshIntervalMs) return;

    const timeout = setTimeout(() => {
      downloadStations().catch(() => {
        // Keep the current stations; the next launch tries again.
      });
    }, refreshDelayMs);
    return () => clearTimeout(timeout);
  }, []);

  return hasDownload ? downloadedStations.uri : bundledUrl;
}
