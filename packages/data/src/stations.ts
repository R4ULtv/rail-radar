import stationsGeoJSONData from "./stations.geojson" with { type: "json" };
import type { Station, StationFeatureCollection } from "./types";

export type { StationFeature, StationFeatureCollection, StationProperties } from "./types";
export { COUNTRY_CODES, getCountry, type CountryCode, type CountryName } from "./countries";

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
