import { COUNTRY_CODES, type CountryCode } from "@repo/data/countries";
import { DEFAULT_LINE_COLOR, getLineStationIds, getStationLines, lineById } from "@repo/data/lines";
import type { Line, LineRoute, Station } from "@repo/data/types";

import { distanceKm } from "@/lib/distance";
import { getInitialDirection, orientRoutes, type LineDirection } from "@/lib/line-directions";
import type { UserLocation } from "@/lib/user-location";

// Lines ship with the app and never update on their own, so they work offline. Their tracks are
// a generated file the map draws from (see use-lines-url.ts), and their stops are the stations
// the map shows, so a stop the stations don't have yet is left out.

// Only the names of the lines' operators, written by metro.config.js.
const operatorNames = require("../../assets/generated/line-operators.json") as Record<
  string,
  string
>;

export type { Line, LineDirection, LineRoute };

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

/**
 * A mark on a line color, like the arrowhead on the line sheet's diagram: white, which reads at a
 * glance as icons do on line signs, unless it falls below WCAG's 3:1 for graphics, as on a yellow.
 */
export function getLineIconColor(color: string): string {
  if (!/^#[\da-f]{6}$/i.test(color)) return LIGHT_TEXT;
  return contrast(color, LIGHT_TEXT) >= 3 ? LIGHT_TEXT : DARK_TEXT;
}

// The cards the line sheet draws line colors on, stone-100 and stone-800 as in global.css, and
// the text on them.
const cardColors = { light: "#f5f5f4", dark: "#292524" };
const cardTextColors = { light: "#1c1917", dark: "#fafaf9" };

/**
 * A line color to draw a mark on a card with, or the card's text color where it would barely show
 * (below WCAG's 3:1 for graphics), like the Northern line's black in dark mode or a yellow in light.
 */
export function getLineColorOnCard(color: string, theme: "light" | "dark"): string {
  if (!/^#[\da-f]{6}$/i.test(color)) return color;
  return contrast(color, cardColors[theme]) >= 3 ? color : cardTextColors[theme];
}

// The sheets a line is drawn on, white and stone-900 as in global.css.
const sheetColors = { light: "#ffffff", dark: "#1c1917" };

/**
 * A line color to draw the line itself with on a sheet, or the sheet's text color where it would
 * all but vanish: the Northern line's black in dark mode, or Amsterdam's 54 yellow in light. Kept
 * low so that a pale yellow or a navy still shows as itself.
 */
export function getLineColorOnSheet(color: string, theme: "light" | "dark"): string {
  if (!/^#[\da-f]{6}$/i.test(color)) return color;
  return contrast(color, sheetColors[theme]) >= 1.3 ? color : cardTextColors[theme];
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

// Suffixes that only repeat what kind of stop it is, like "Howald, Gare (Tram)".
const typeSuffixes = new Set(["tram", "metro", "métro", "metrolink"]);

function toSlug(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, "-");
}

/**
 * A stop's name for its own title, with the city its suffix names on its own: "Loreto (Milano)"
 * is "Loreto" in Milano. A suffix that tells stops apart, like Bochum Rathaus (Nord) and (Süd),
 * stays in the name.
 */
export function splitStationName(station: Pick<Station, "id" | "name" | "type">): {
  name: string;
  place: string | null;
} {
  const match = station.type === "rail" ? null : /^(.+?)\s+\(([^)]+)\)$/.exec(station.name);
  if (!match) return { name: station.name, place: null };
  const name = match[1]!;
  const suffix = match[2]!;
  if (typeSuffixes.has(suffix.toLowerCase())) return { name, place: null };
  const slug = toSlug(suffix);
  const isNetwork = getStationLines(station.id).some((line) => getLineNetwork(line) === slug);
  return isNetwork ? { name, place: suffix } : { name: station.name, place: null };
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

/** How many of a route's stops the stations know, counting a loop's first stop once. */
export function getRouteStopCount(
  route: LineRoute,
  stationsById: ReadonlyMap<string, Station>,
): number {
  return new Set(route.stations.filter((id) => stationsById.has(id))).size;
}

/**
 * The stop to name a stretch of a route by, "via Bank": the one served by the most lines, since
 * that's the one people know.
 */
export function getViaStation(
  ids: readonly string[],
  stationsById: ReadonlyMap<string, Station>,
): Station | null {
  let best: Station | null = null;
  let bestLines = -1;
  for (const id of ids) {
    const station = stationsById.get(id);
    if (!station) continue;
    const lineCount = getStationLines(id).length;
    if (lineCount > bestLines) {
      best = station;
      bestLines = lineCount;
    }
  }
  return best;
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

const orientedRoutes = new WeakMap<Line, string[][]>();

/** The line's routes' stops, all listed the same way round (see orientRoutes). */
export function getOrientedRoutes(line: Line): string[][] {
  let routes = orientedRoutes.get(line);
  if (!routes) {
    routes = orientRoutes(line.routes.map((route) => route.stations));
    orientedRoutes.set(line, routes);
  }
  return routes;
}

/** The oriented routes' stops that the stations know, like the stop list and diagram show. */
export function getKnownRoutes(line: Line, stationsById: ReadonlyMap<string, Station>): string[][] {
  return getOrientedRoutes(line).map((stations) => stations.filter((id) => stationsById.has(id)));
}

/** Where to go along the line at first, from the stop it was opened from. */
export function getLineInitialDirection(line: Line, stationId: string | null): LineDirection {
  return getInitialDirection(getOrientedRoutes(line), stationId);
}
