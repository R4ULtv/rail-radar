import type { Station } from "@repo/data";
import { isStationPagePrerendered } from "@/lib/station-prerender";

type StationNavigationCandidate = Pick<Station, "type" | "importance">;

export function getStationPageLinkOptions(station: StationNavigationCandidate) {
  const reloadDocument = isStationPagePrerendered(station);

  return {
    reloadDocument,
    preload: reloadDocument ? (false as const) : ("intent" as const),
  };
}
