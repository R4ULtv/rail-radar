import type { Station, StationFeatureCollection } from "@repo/data/types";
import { File } from "expo-file-system";

import { createStationSearch } from "@/lib/station-search-index";

export type StationSearch = ReturnType<typeof createStationSearch>;

let loaded: { url: string; search: Promise<StationSearch> } | null = null;

async function readStations(url: string): Promise<Station[]> {
  const collection = JSON.parse(await new File(url).text()) as StationFeatureCollection;
  if (!Array.isArray(collection?.features)) throw new Error("Stations are invalid.");

  return collection.features.map(({ properties, geometry }) => ({
    id: properties.id,
    name: properties.name,
    type: properties.type,
    importance: properties.importance,
    geo: { lat: geometry.coordinates[1]!, lng: geometry.coordinates[0]! },
  }));
}

/**
 * Searches the station GeoJSON the map shows (bundled, or the downloaded update), so
 * searching works offline and the location never leaves the device.
 * The index is built once per file.
 */
export function loadStationSearch(url: string): Promise<StationSearch> {
  if (loaded?.url !== url) {
    const search = readStations(url).then(createStationSearch);
    // A failed load is retried on the next call.
    search.catch(() => {
      if (loaded?.search === search) loaded = null;
    });
    loaded = { url, search };
  }
  return loaded.search;
}
