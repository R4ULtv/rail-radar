import type { Station } from "@repo/data";

type StationPrerenderCandidate = Pick<Station, "type" | "importance">;

export function isStationPagePrerendered(station: StationPrerenderCandidate): boolean {
  return station.type === "rail" && station.importance <= 3;
}

/**
 * Link props for routes whose loaders call a server function (`/station/$id`,
 * `/stations/$country`, `/stations`). A client-side navigation or intent preload runs
 * that server function on the Worker, while a document navigation to a prerendered
 * page is answered by the static asset layer without invoking the Worker at all.
 * Non-prerendered station pages keep client navigation — a server function is far
 * cheaper than a full SSR — but skip hover preloading.
 */
export const prerenderedPageLinkProps = { reloadDocument: true } as const;

export function stationPageLinkProps(station: StationPrerenderCandidate | null) {
  return station && isStationPagePrerendered(station)
    ? prerenderedPageLinkProps
    : ({ preload: false } as const);
}
