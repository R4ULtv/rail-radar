import type { Station } from "@repo/data";

export type StationTypeFilter = "all" | Station["type"] | "duplicate";
export type StationImportanceFilter = "any" | "1" | "2" | "3" | "4";

export function findDuplicateStationIds(stations: Station[]): Set<string> {
  const nameCounts = new Map<string, number>();
  const geoCounts = new Map<string, number>();

  for (const station of stations) {
    const name = station.name.toLowerCase();
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);

    if (station.geo) {
      const key = `${station.geo.lat},${station.geo.lng}`;
      geoCounts.set(key, (geoCounts.get(key) ?? 0) + 1);
    }
  }

  return new Set(
    stations
      .filter((station) => {
        const duplicateName = (nameCounts.get(station.name.toLowerCase()) ?? 0) > 1;
        const duplicateGeo =
          station.geo && (geoCounts.get(`${station.geo.lat},${station.geo.lng}`) ?? 0) > 1;
        return duplicateName || duplicateGeo;
      })
      .map((station) => station.id),
  );
}

export function stationMatchesFilters(
  station: Station,
  search: string,
  typeFilter: StationTypeFilter,
  importanceFilter: StationImportanceFilter,
  duplicateStationIds: Set<string>,
): boolean {
  const query = search.trim().toLowerCase();
  const matchesSearch =
    station.name.toLowerCase().includes(query) || station.id.toLowerCase().includes(query);

  if (query && !matchesSearch) return false;
  if (typeFilter !== "all" && typeFilter !== "duplicate" && station.type !== typeFilter)
    return false;
  if (typeFilter === "duplicate" && !duplicateStationIds.has(station.id)) return false;
  if (importanceFilter !== "any" && station.importance !== Number(importanceFilter)) return false;

  return true;
}
