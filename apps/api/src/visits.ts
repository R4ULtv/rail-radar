import type { Station } from "@repo/data";

export interface StationVisit {
  id: number;
  name: string;
  visits: number;
}

const DEFAULT_TOP_STATIONS = [
  { id: 1728, name: "Milano Centrale" },
  { id: 2416, name: "Roma Termini" },
  { id: 1325, name: "Firenze Santa Maria Novella" },
  { id: 1888, name: "Napoli Centrale" },
  { id: 3009, name: "Venezia S.Lucia" },
];

export async function incrementVisitCount(
  kv: KVNamespace,
  stationId: number,
): Promise<void> {
  const key = `visits:${stationId}`;
  try {
    const currentValue = await kv.get(key);
    const count = currentValue ? parseInt(currentValue, 10) : 0;
    await kv.put(key, String(count + 1));
  } catch (error) {
    console.error(
      `Failed to increment visit count for station ${stationId}:`,
      error,
    );
  }
}

export async function getVisitCount(
  kv: KVNamespace,
  stationId: number,
): Promise<number> {
  const count = await kv.get(`visits:${stationId}`);
  return count ? parseInt(count, 10) : 0;
}

export async function getTopStations(
  kv: KVNamespace,
  stations: Station[],
): Promise<StationVisit[]> {
  const listResult = await kv.list({ prefix: "visits:" });

  const stationVisits: StationVisit[] = [];

  for (const key of listResult.keys) {
    const stationId = parseInt(key.name.replace("visits:", ""), 10);
    const count = await kv.get(key.name);
    const station = stations.find((s) => s.id === stationId);

    if (count && station) {
      stationVisits.push({
        id: stationId,
        name: station.name,
        visits: parseInt(count, 10),
      });
    }
  }

  // Sort by visits descending
  stationVisits.sort((a, b) => b.visits - a.visits);

  // Take top 5
  const topStations = stationVisits.slice(0, 5);

  // Fill with defaults if needed
  if (topStations.length < 5) {
    const existingIds = new Set(topStations.map((s) => s.id));
    for (const defaultStation of DEFAULT_TOP_STATIONS) {
      if (topStations.length >= 5) break;
      if (!existingIds.has(defaultStation.id)) {
        topStations.push({ ...defaultStation, visits: 0 });
        existingIds.add(defaultStation.id);
      }
    }
  }

  return topStations;
}
