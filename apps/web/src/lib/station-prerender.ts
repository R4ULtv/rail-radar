import type { Station } from "@repo/data";

type StationPrerenderCandidate = Pick<Station, "type" | "importance">;

export function isStationPagePrerendered(station: StationPrerenderCandidate): boolean {
  return station.type === "rail" && station.importance <= 3;
}
