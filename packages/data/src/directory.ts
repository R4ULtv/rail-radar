import { getCountry, type CountryCode } from "./countries";
import { stations } from "./stations";
import type { Station } from "./types";

export type StationWithGeo = Station & { geo: { lat: number; lng: number } };

/**
 * Both structures below are built lazily and memoized rather than at module scope.
 * Grouping and name-sorting ~19k rail stations costs ~12ms of CPU, which used to be
 * charged to isolate startup for *every* route that transitively imported this module
 * — including `/station/[id]`, which never reads either structure. Only the country
 * directory pages and the sitemap need them.
 */
let stationsByCountryCache: Map<CountryCode, StationWithGeo[]> | undefined;
let countryStationBoundsCache: Map<CountryCode, [number, number, number, number]> | undefined;

/**
 * Rail stations (with geo) grouped by country, sorted by name. These are exactly
 * the stations that have an individual /station/[id] page, used by the directory.
 */
export function getStationsByCountry(): Map<CountryCode, StationWithGeo[]> {
  if (stationsByCountryCache) return stationsByCountryCache;

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

  return (stationsByCountryCache = grouped);
}

/** [west, south, east, north] bounding box of each country's rail stations */
export function getCountryStationBounds(): Map<CountryCode, [number, number, number, number]> {
  if (countryStationBoundsCache) return countryStationBoundsCache;

  const bounds = new Map<CountryCode, [number, number, number, number]>();
  for (const [code, list] of getStationsByCountry()) {
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

  return (countryStationBoundsCache = bounds);
}
