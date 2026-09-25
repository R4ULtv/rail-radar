import type { Station, StationFeatureCollection } from "@repo/data/types";
import { File } from "expo-file-system";

import { distanceKm } from "@/lib/distance";
import { createStationSearch } from "@/lib/station-search-index";

export type StationSearch = ReturnType<typeof createStationSearch>;
export type NearbyStation = Station & { distance: number };

interface LoadedStations {
  url: string;
  stations: Promise<Station[]>;
  search?: Promise<StationSearch>;
}

let loaded: LoadedStations | null = null;

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

function load(url: string): LoadedStations {
  if (loaded?.url !== url) {
    const stations = readStations(url);
    // A failed load is retried on the next call.
    stations.catch(() => {
      if (loaded?.stations === stations) loaded = null;
    });
    loaded = { url, stations };
  }
  return loaded;
}

/**
 * Reads the station GeoJSON the map shows (bundled, or the downloaded update), so searching
 * and nearby stations work offline and the location never leaves the device.
 * The stations are read once per file.
 */
export function loadStations(url: string): Promise<Station[]> {
  return load(url).stations;
}

/**
 * The search index over the same stations. It is built on the first search rather than with
 * the stations, since it takes several times as long as reading them.
 */
export function loadStationSearch(url: string): Promise<StationSearch> {
  const current = load(url);
  current.search ??= current.stations.then(createStationSearch);
  return current.search;
}

function nearestStations(
  stations: Station[],
  from: Station & { geo: NonNullable<Station["geo"]> },
  type: Station["type"],
  limit: number,
): NearbyStation[] {
  const result: NearbyStation[] = [];
  for (const station of stations) {
    if (station.type !== type || station.id === from.id || !station.geo) continue;
    const distance = distanceKm({ latitude: from.geo.lat, longitude: from.geo.lng }, station.geo);
    if (result.length === limit && distance >= result[limit - 1]!.distance) continue;

    let index = result.findIndex((candidate) => candidate.distance >= distance);
    if (index === -1) index = result.length;
    result.splice(index, 0, { ...station, distance });
    if (result.length > limit) result.pop();
  }
  return result;
}

/** Like the web's station page: the closest train stations, plus the closest metro stop. */
export function findNearbyStations(stations: Station[], station: Station): NearbyStation[] {
  if (!station.geo) return [];
  const from = { ...station, geo: station.geo };
  return [
    ...nearestStations(stations, from, "rail", 4),
    ...nearestStations(stations, from, "metro", 1),
  ]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);
}
