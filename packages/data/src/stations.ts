import stationsGeoJSONData from "./stations.geojson" with { type: "json" };
import type { Station, StationFeatureCollection } from "./types";

/** GeoJSON FeatureCollection of all stations */
export const stationsGeoJSON = stationsGeoJSONData as StationFeatureCollection;

/**
 * Derived flat station array for backward compat (API search, etc.) and the O(1)
 * lookup map, built in a single pass. Both are needed together on every path that
 * touches station data, and this runs during module evaluation on a cold isolate,
 * so it avoids the 21k intermediate `[id, station]` tuples that `new Map(arr.map())`
 * would allocate.
 *
 * Uses `push` rather than a preallocated `new Array(n)`: the latter leaves V8 with a
 * HOLEY elements kind, and this array is scanned end-to-end on every station render.
 */
const stationList: Station[] = [];
const stationIndex = new Map<string, Station>();

for (const { properties, geometry } of stationsGeoJSON.features) {
  const station: Station = {
    id: properties.id,
    name: properties.name,
    type: properties.type,
    importance: properties.importance,
    geo: {
      lat: geometry.coordinates[1]!,
      lng: geometry.coordinates[0]!,
    },
  };

  stationList.push(station);
  stationIndex.set(station.id, station);
}

export const stations: Station[] = stationList;

/** Station lookup by ID - O(1) instead of O(n) */
export const stationById: Map<string, Station> = stationIndex;
