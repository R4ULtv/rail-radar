import type { Station } from "@repo/data/types";
import { DEG_TO_RAD, EARTH_RADIUS_KM, stationDistance } from "../src/lib/nearby-stations.ts";
import type { NearbyStationIds, StationWithGeo } from "../src/lib/nearby-stations.ts";

type IndexedStation = { station: StationWithGeo; order: number };
type Candidate = IndexedStation & { distance: number };

function nearestStations(
  current: StationWithGeo,
  sorted: readonly IndexedStation[],
  limit: number,
): Candidate[] {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sorted[middle]!.station.geo.lat < current.geo.lat) low = middle + 1;
    else high = middle;
  }

  let left = low - 1;
  let right = low;
  const result: Candidate[] = [];
  while (left >= 0 || right < sorted.length) {
    const leftGap = left >= 0 ? current.geo.lat - sorted[left]!.station.geo.lat : Infinity;
    const rightGap =
      right < sorted.length ? sorted[right]!.station.geo.lat - current.geo.lat : Infinity;
    const gap = Math.min(leftGap, rightGap);

    // A great-circle distance cannot be shorter than its latitude difference.
    // The small tolerance keeps candidates on the boundary despite floating-point rounding.
    if (
      result.length === limit &&
      gap * DEG_TO_RAD * EARTH_RADIUS_KM > result[limit - 1]!.distance + 1e-9
    ) {
      break;
    }

    const entry = leftGap <= rightGap ? sorted[left--]! : sorted[right++]!;
    if (entry.station.id === current.id) continue;

    const distance = stationDistance(current, entry.station);
    // The old scan inserts equal-distance candidates before earlier catalog entries.
    const index = result.findIndex(
      (candidate) =>
        candidate.distance > distance ||
        (candidate.distance === distance && candidate.order < entry.order),
    );
    const insertion = index === -1 ? result.length : index;
    if (insertion >= limit) continue;
    result.splice(insertion, 0, { ...entry, distance });
    if (result.length > limit) result.pop();
  }

  return result;
}

/** Build-only latitude indexes avoid an all-stations scan for every generated page. */
export function generateNearbyStationIds(stations: readonly Station[]): NearbyStationIds {
  const rail: IndexedStation[] = [];
  const metro: IndexedStation[] = [];
  for (const [order, station] of stations.entries()) {
    if (!station.geo) continue;
    const entry = { station: { ...station, geo: station.geo }, order };
    if (station.type === "rail") rail.push(entry);
    else if (station.type === "metro") metro.push(entry);
  }

  const byLatitude = (a: IndexedStation, b: IndexedStation) =>
    a.station.geo.lat - b.station.geo.lat || a.order - b.order;
  rail.sort(byLatitude);
  metro.sort(byLatitude);

  const result: NearbyStationIds = Object.create(null);
  for (const { station } of rail) {
    result[station.id] = [
      ...nearestStations(station, rail, 4),
      ...nearestStations(station, metro, 1),
    ]
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4)
      .map(({ station: neighbor }) => neighbor.id);
  }
  return result;
}
