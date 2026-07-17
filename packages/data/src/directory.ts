import { getCountry, type CountryCode } from "./countries";
import { stations } from "./stations";
import type { Station } from "./types";

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
