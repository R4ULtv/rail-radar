import data from "./lines.json" with { type: "json" };
import type { Line, LineGeometry, LineRoute } from "./types";

/** Neutral gray for lines with no official color; readable on light and dark backgrounds. */
export const DEFAULT_LINE_COLOR = "#8E8E93";

/** Unique station IDs across all branches, derived from their ordered stop lists. */
export function getLineStationIds(line: {
  routes: readonly { stations: readonly string[] }[];
}): string[] {
  const ids = new Set<string>();
  for (const route of line.routes) for (const id of route.stations) ids.add(id);
  return [...ids];
}

/** Whether `inner` runs along `outer` in either direction: a short trip, not a branch. */
export function isRouteWithin(inner: readonly string[], outer: readonly string[]): boolean {
  if (inner.length > outer.length) return false;
  const key = (stations: readonly string[]) => `,${stations.join(",")},`;
  const path = key(outer);
  return path.includes(key(inner)) || path.includes(key([...inner].reverse()));
}

/** Build lookups for the supplied lines or selection; the supplied collection is indexed independently. */
export function createLineIndex(lines: Line[]) {
  const lineById = new Map<string, Line>();
  const linesByStation = new Map<string, Line[]>();
  const routesByStation = new Map<string, { line: Line; route: LineRoute }[]>();
  for (const line of lines) {
    if (lineById.has(line.id)) throw new Error(`Duplicate line ID: ${line.id}`);
    lineById.set(line.id, line);
    const visited = new Set<string>();
    for (const route of line.routes) {
      for (const stationId of new Set(route.stations)) {
        if (!visited.has(stationId)) {
          visited.add(stationId);
          const servingLines = linesByStation.get(stationId);
          if (servingLines) servingLines.push(line);
          else linesByStation.set(stationId, [line]);
        }
        const servingRoutes = routesByStation.get(stationId);
        const match = { line, route };
        if (servingRoutes) servingRoutes.push(match);
        else routesByStation.set(stationId, [match]);
      }
    }
  }
  const noLines: readonly Line[] = [];
  const noRoutes: readonly { line: Line; route: LineRoute }[] = [];
  return {
    lineById,
    /** Every line serving a station, including interchanges and branch-only stops. */
    getStationLines: (stationId: string): readonly Line[] =>
      linesByStation.get(stationId) ?? noLines,
    /** Branches stopping at this station, with their complete ordered stops. */
    getStationRoutes: (stationId: string): readonly { line: Line; route: LineRoute }[] =>
      routesByStation.get(stationId) ?? noRoutes,
  };
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}
function optionalText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label);
}
function fields(value: Record<string, unknown>, keys: string[], label: string) {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new Error(`${label}: unsupported field "${key}"`);
  }
}

/** Validate edits/imports against the canonical station registry and keep the compact schema. */
export function validateLines(value: unknown, stationIds: ReadonlySet<string>): Line[] {
  if (!Array.isArray(value)) throw new Error("Lines must be a JSON array");
  const lineIds = new Set<string>();
  return value.map((entry, index) => {
    const line = object(entry, `Line ${index + 1}`);
    fields(
      line,
      ["id", "name", "description", "code", "type", "color", "operator", "routes"],
      "Line",
    );
    const id = text(line.id, "Line ID");
    if (!/^[a-z]{2}(?:-[a-z0-9]+)+$/.test(id)) {
      throw new Error(
        "Line ID must be a lowercase slug: country, network, then code or short name, e.g. it-milano-m1",
      );
    }
    if (lineIds.has(id)) throw new Error(`Duplicate line ID: ${id}`);
    lineIds.add(id);
    if (line.type !== "metro" && line.type !== "light") throw new Error(`${id}: invalid type`);
    const description =
      line.description === undefined ? undefined : text(line.description, `${id}: description`);
    const color = optionalText(line.color, `${id}: color`);
    if (color !== null && !/^#[\da-f]{6}$/i.test(color)) {
      throw new Error(`${id}: color must be a #RRGGBB hex color or null`);
    }
    const operator = optionalText(line.operator, `${id}: operator`);
    if (operator !== null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(operator)) {
      throw new Error(`${id}: operator must be an operators.json slug, e.g. atm-milano`);
    }
    if (!Array.isArray(line.routes) || !line.routes.length) {
      throw new Error(`${id}: at least one route is required`);
    }
    const routes: LineRoute[] = line.routes.map((entry, routeIndex) => {
      const label = `${id} route ${routeIndex + 1}`;
      const route = object(entry, label);
      fields(route, ["code", "stations"], label);
      const code = route.code === undefined ? undefined : text(route.code, `${label}: code`);
      if (!Array.isArray(route.stations)) throw new Error(`${label}: stops must be an array`);
      const stations = route.stations.map((value) => {
        const stationId = text(value, `${label}: station ID`);
        if (!stationIds.has(stationId)) throw new Error(`${label}: unknown station ${stationId}`);
        return stationId;
      });
      if (new Set(stations).size < 2)
        throw new Error(`${label}: at least two distinct stops are required`);
      return { ...(code !== undefined && { code }), stations };
    });
    for (const [inner, route] of routes.entries()) {
      for (const [outer, other] of routes.entries()) {
        if (inner !== outer && isRouteWithin(route.stations, other.stations)) {
          throw new Error(
            `${id}: route ${inner + 1} runs within route ${outer + 1}; list only distinct branches`,
          );
        }
      }
    }
    return {
      id,
      code: optionalText(line.code, `${id}: code`),
      name: text(line.name, `${id}: name`),
      ...(description && { description }),
      type: line.type,
      color: color?.toUpperCase() ?? null,
      operator,
      routes,
    };
  });
}

/** Validate a line's track file: a GeoJSON MultiLineString of [longitude, latitude] positions. */
export function validateLineGeometry(value: unknown, label: string): LineGeometry {
  const geometry = object(value, `${label}: geometry`);
  fields(geometry, ["type", "coordinates"], `${label}: geometry`);
  if (geometry.type !== "MultiLineString" || !Array.isArray(geometry.coordinates)) {
    throw new Error(`${label}: geometry must be a GeoJSON MultiLineString`);
  }
  const coordinates = geometry.coordinates.map((segment) => {
    if (!Array.isArray(segment) || segment.length < 2) {
      throw new Error(`${label}: each geometry segment needs at least two positions`);
    }
    return segment.map((position) => {
      if (
        !Array.isArray(position) ||
        position.length !== 2 ||
        !position.every((number) => typeof number === "number" && Number.isFinite(number)) ||
        Math.abs(position[0]) > 180 ||
        Math.abs(position[1]) > 90
      ) {
        throw new Error(`${label}: invalid [longitude, latitude] position`);
      }
      return [position[0], position[1]] as [number, number];
    });
  });
  return { type: "MultiLineString", coordinates };
}

/** Every line without track; each line's geometry is a separate file in src/lines/. */
export const lines = data as Line[];
export const { lineById, getStationLines, getStationRoutes } = createLineIndex(lines);
