import { COUNTRY_CODES, type CountryCode } from "@repo/data/countries";
import { DEFAULT_LINE_COLOR, getLineStationIds, lineById } from "@repo/data/lines";
import type { Line, LineRoute, Station } from "@repo/data/types";

import { distanceKm } from "@/lib/distance";
import type { UserLocation } from "@/lib/user-location";

// Lines ship with the app and never update on their own, so they work offline. Their tracks are
// a generated file the map draws from (see use-lines-url.ts), and their stops are the stations
// the map shows, so a stop the stations don't have yet is left out.

// Only the names of the lines' operators, written by metro.config.js.
const operatorNames = require("../../assets/generated/line-operators.json") as Record<
  string,
  string
>;

export type { Line, LineRoute };

/** Whether a search result is a line rather than a station. */
export function isLine(item: Station | Line): item is Line {
  return "routes" in item;
}

export function getLine(id: string): Line | undefined {
  return lineById.get(id);
}

export const lineTypeLabels: Record<Line["type"], string> = {
  metro: "Metro",
  light: "Light rail",
};

export function getLineColor(line: Pick<Line, "color">): string {
  return line.color ?? DEFAULT_LINE_COLOR;
}

/** Short public codes (M1, A, T1) fit a badge; longer ones read better as plain names. */
export function getLineBadgeCode(line: Pick<Line, "code">): string | null {
  return line.code && line.code.length <= 4 ? line.code : null;
}

const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#18181b";

/** WCAG 2 relative luminance of a #RRGGBB color. */
function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/**
 * Text on a line color, like the web: white unless it falls below WCAG AA (4.5:1) and dark text
 * reaches it. Mid tones like Milano M1's red pass with neither, and keep the white their signs use.
 */
export function getLineTextColor(color: string): string {
  if (!/^#[\da-f]{6}$/i.test(color)) return LIGHT_TEXT;
  return contrast(color, LIGHT_TEXT) < 4.5 && contrast(color, DARK_TEXT) >= 4.5
    ? DARK_TEXT
    : LIGHT_TEXT;
}

export function getLineCountry(line: Line): CountryCode | null {
  const code = line.id.slice(0, 2) as CountryCode;
  return COUNTRY_CODES.includes(code) ? code : null;
}

export function getLineOperatorName(line: Line): string | null {
  return (line.operator && operatorNames[line.operator]) || null;
}

/** The city or network the line's ID names, e.g. "milano" for it-milano-m1. */
export function getLineNetwork(line: Line): string {
  return line.id.split("-")[1] ?? "";
}

/** "Battistini (Roma)" reads as "Battistini" next to a line that already says where it runs. */
export function shortStationName(name: string): string {
  return name.replace(/\s+\([^)]*\)$/, "");
}

/** The stops of a route that the stations know, in order. */
export function getRouteStops(route: LineRoute, stationsById: ReadonlyMap<string, Station>) {
  return route.stations.flatMap((id) => {
    const station = stationsById.get(id);
    return station ? [station] : [];
  });
}

/** How many stops the line has across its branches, counting each once. */
export function getLineStopCount(line: Line): number {
  return getLineStationIds(line).length;
}

/**
 * Where a line runs, "Rho Fiera – Sesto 1° Maggio FS", from its first branch; a loop names the
 * stop it starts from. Null until the stops' names are known.
 */
export function getLineTermini(
  line: Line,
  stationsById: ReadonlyMap<string, Station>,
): string | null {
  const stations = line.routes[0]?.stations ?? [];
  const first = stations[0] ? stationsById.get(stations[0]) : undefined;
  const last = stations.at(-1) ? stationsById.get(stations.at(-1)!) : undefined;
  if (!first || !last) return null;
  if (first.id === last.id) return `Loop via ${shortStationName(first.name)}`;
  return `${shortStationName(first.name)} – ${shortStationName(last.name)}`;
}

/**
 * Branch labels that say where each one goes, like the web: when every branch starts (or ends)
 * at the same stop, only the other end tells them apart, and branches that each end somewhere
 * else read as their destination.
 */
export function getBranchLabel(
  routes: readonly LineRoute[],
  route: LineRoute,
  stationsById: ReadonlyMap<string, Station>,
): string {
  const name = (id: string | undefined) => {
    const station = id ? stationsById.get(id) : undefined;
    return station ? shortStationName(station.name) : "";
  };
  const firsts = new Set(routes.map((other) => other.stations[0]));
  const lasts = new Set(routes.map((other) => other.stations.at(-1)));
  const first = name(route.stations[0]);
  const last = name(route.stations.at(-1));
  if (firsts.size === 1 && lasts.size === routes.length) return last;
  if (lasts.size === 1 && firsts.size === routes.length) return first;
  if (lasts.size === routes.length) return `To ${last}`;
  return `${first} – ${last}`;
}

/** [west, south, east, north] around the line's stops, to fit the map to it. */
export function getLineBounds(
  line: Line,
  stationsById: ReadonlyMap<string, Station>,
): [number, number, number, number] | null {
  let bounds: [number, number, number, number] | null = null;
  for (const id of getLineStationIds(line)) {
    const geo = stationsById.get(id)?.geo;
    if (!geo) continue;
    if (!bounds) bounds = [geo.lng, geo.lat, geo.lng, geo.lat];
    else {
      bounds[0] = Math.min(bounds[0], geo.lng);
      bounds[1] = Math.min(bounds[1], geo.lat);
      bounds[2] = Math.max(bounds[2], geo.lng);
      bounds[3] = Math.max(bounds[3], geo.lat);
    }
  }
  return bounds;
}

/**
 * How far the line's closest stop is, like a station's distance in search. Null when none of its
 * stops are known.
 */
export function getLineDistanceKm(
  line: Line,
  stationsById: ReadonlyMap<string, Station>,
  from: UserLocation,
): number | null {
  let closest: number | null = null;
  for (const id of getLineStationIds(line)) {
    const geo = stationsById.get(id)?.geo;
    if (!geo) continue;
    const distance = distanceKm(from, geo);
    if (closest === null || distance < closest) closest = distance;
  }
  return closest;
}

/** The first branch through the stop a line was opened from, or the first branch. */
export function getInitialBranch(line: Line, stationId: string | null): number {
  if (!stationId) return 0;
  return Math.max(
    0,
    line.routes.findIndex((route) => route.stations.includes(stationId)),
  );
}

/** A run of stops left out of a short list of them, shown as dots to expand. */
export interface HiddenStops {
  /** Where the run starts among all the stops. */
  from: number;
  count: number;
}

// A list this short shows every stop.
const maxCollapsedStops = 7;

/**
 * Which of a route's stops to show before the rest are expanded: the termini, and the stop the
 * line was opened from with the ones either side of it. Hiding a single stop saves no room, so
 * only runs of two or more are hidden.
 */
export function collapseStops(stopCount: number, focusIndex: number): (number | HiddenStops)[] {
  const all = Array.from({ length: stopCount }, (_, index) => index);
  if (stopCount <= maxCollapsedStops) return all;

  const shown = new Set([0, stopCount - 1]);
  if (focusIndex >= 0) {
    for (const index of [focusIndex - 1, focusIndex, focusIndex + 1]) {
      if (index >= 0 && index < stopCount) shown.add(index);
    }
  }
  const kept = [...shown].sort((a, b) => a - b);

  const items: (number | HiddenStops)[] = [];
  for (const [position, index] of kept.entries()) {
    const previous = kept[position - 1];
    if (previous !== undefined) {
      const count = index - previous - 1;
      if (count === 1) items.push(previous + 1);
      else if (count > 1) items.push({ from: previous + 1, count });
    }
    items.push(index);
  }
  return items;
}
