import type { Station } from "@repo/data";

type StationPrerenderCandidate = Pick<Station, "type">;

export function isStationPagePrerendered(station: StationPrerenderCandidate): boolean {
  return station.type === "rail";
}

/**
 * Link props for routes whose loaders call a server function (`/station/$id`,
 * `/stations/$country`, `/stations`). A client-side navigation or intent preload runs
 * that server function on the Worker, while a document navigation to a prerendered
 * page is answered by the static asset layer without invoking the Worker at all.
 * Rail station pages all use static document navigation. Other station types keep
 * client navigation without hover preloading; their dedicated pages redirect to the map.
 */
export const prerenderedPageLinkProps = { reloadDocument: true } as const;

export function stationPageLinkProps(
  station: StationPrerenderCandidate | { prerendered?: boolean } | null,
) {
  const prerendered =
    station != null &&
    ("type" in station ? isStationPagePrerendered(station) : station.prerendered === true);
  return prerendered ? prerenderedPageLinkProps : ({ preload: false } as const);
}
