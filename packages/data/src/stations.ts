import stationsGeoJSONData from "./stations.geojson" with { type: "json" };
import type { Station, StationFeatureCollection } from "./types";
import { getCountry, type CountryCode } from "./countries";

/** GeoJSON FeatureCollection of all stations */
export const stationsGeoJSON = stationsGeoJSONData as StationFeatureCollection;

/** Derived flat station array for backward compat (API search, etc.) */
export const stations: Station[] = stationsGeoJSON.features.map((f) => ({
  id: f.properties.id,
  name: f.properties.name,
  type: f.properties.type,
  importance: f.properties.importance,
  geo: {
    lat: f.geometry.coordinates[1]!,
    lng: f.geometry.coordinates[0]!,
  },
}));

/** Station lookup by ID - O(1) instead of O(n) */
export const stationById = new Map<string, Station>(stations.map((s) => [s.id, s]));

type StationWithGeo = Station & { geo: { lat: number; lng: number } };

/**
 * Rail stations (with geo) grouped by country, sorted by name. These are exactly
 * the stations that have an individual /station/[id] page, used by the directory.
 */
export const stationsByCountry: Map<CountryCode, StationWithGeo[]> = (() => {
  const grouped = new Map<CountryCode, StationWithGeo[]>();
  for (const station of stations) {
    if (station.type !== "rail" || !station.geo) continue;
    const code = getCountry(station.id);
    if (!code) continue;
    (grouped.get(code) ?? grouped.set(code, []).get(code)!).push(station as StationWithGeo);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return grouped;
})();

/** [west, south, east, north] bounding box of each country's rail stations */
export const countryStationBounds: Map<CountryCode, [number, number, number, number]> = (() => {
  const bounds = new Map<CountryCode, [number, number, number, number]>();
  for (const [code, list] of stationsByCountry) {
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    for (const { geo } of list) {
      if (geo.lng < west) west = geo.lng;
      if (geo.lng > east) east = geo.lng;
      if (geo.lat < south) south = geo.lat;
      if (geo.lat > north) north = geo.lat;
    }
    bounds.set(code, [west, south, east, north]);
  }
  return bounds;
})();
