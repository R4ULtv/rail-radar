import type { Station } from "@repo/data/types";

export type StationWithGeo = Station & { geo: { lat: number; lng: number } };
export type NearbyStation = StationWithGeo & { distance: number };
export type NearbyStationIds = Record<string, readonly string[]>;

export const EARTH_RADIUS_KM = 6371;
export const DEG_TO_RAD = Math.PI / 180;

export function stationDistance(from: StationWithGeo, to: StationWithGeo): number {
  const dLat = (to.geo.lat - from.geo.lat) * DEG_TO_RAD;
  const dLng = (to.geo.lng - from.geo.lng) * DEG_TO_RAD;
  const lat1Rad = from.geo.lat * DEG_TO_RAD;
  const lat2Rad = to.geo.lat * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Neighbor selection happens at build time; requests only resolve four IDs and distances. */
export function resolveNearbyStations(
  station: StationWithGeo,
  ids: readonly string[],
  stationsById: ReadonlyMap<string, Station>,
): NearbyStation[] {
  return ids.map((id) => {
    const neighbor = stationsById.get(id);
    if (!neighbor?.geo) throw new Error(`Missing nearby station: ${id}`);

    const withGeo = { ...neighbor, geo: neighbor.geo };
    return { ...withGeo, distance: stationDistance(station, withGeo) };
  });
}
