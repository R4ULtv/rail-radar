import { COUNTRY_CODES } from "@repo/data/countries";
import {
  getLineStationIds,
  getStationLines,
  lineById,
  validateLineGeometry,
} from "@repo/data/lines";
import { operators } from "@repo/data/operators";
import { stationById } from "@repo/data/stations";
import type { Line, LineGeometry, Station } from "@repo/data/types";

import { parseFilterList, validateFilter } from "./http";

const LINE_TYPES = ["metro", "light"] as const satisfies readonly Line["type"][];
const INCLUDES = ["stops"] as const;
const OPERATOR_SLUGS = operators.map((operator) => operator.slug);
const DIACRITICS_REGEX = /[\u0300-\u036f]/g;

export type LineFilters = {
  ids: string[];
  query: string;
  countries: string[];
  types: Line["type"][];
  operators: string[];
  /** Add the stops of the selected lines to the response (`include=stops`). */
  includeStops: boolean;
};

export type LineStop = Pick<Station, "name" | "type" | "importance" | "geo"> & {
  /** Every line serving the stop, selected or not. */
  lines: string[];
};
export type LineSummary = Pick<Line, "id" | "code" | "name" | "type" | "color">;
export type LineStops = {
  stops: Record<string, LineStop>;
  /** Lines serving a stop that aren't in the selection, so interchanges can be drawn. */
  connections: LineSummary[];
};

export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS_REGEX, "").toLowerCase().trim();
}

/** Validate the shared id/q/country/type/operator filters and `include`; empty values mean none. */
export function parseLineFilters(
  query: (name: string) => string | undefined,
): { filters: LineFilters; error: null } | { filters: null; error: string } {
  const ids = parseFilterList(query("id"));
  if (ids.some((id) => !lineById.has(id))) {
    return { filters: null, error: "Invalid id. Must be known line IDs; see GET /lines." };
  }

  const countries = validateFilter("country", parseFilterList(query("country")), COUNTRY_CODES);
  if (countries.error) return { filters: null, error: countries.error };

  const types = validateFilter("type", parseFilterList(query("type")), LINE_TYPES);
  if (types.error) return { filters: null, error: types.error };

  const operatorSlugs = parseFilterList(query("operator"));
  if (operatorSlugs.some((slug) => !OPERATOR_SLUGS.includes(slug))) {
    return {
      filters: null,
      error: "Invalid operator. Must be a known operator slug; see GET /operators.",
    };
  }

  const include = validateFilter("include", parseFilterList(query("include")), INCLUDES);
  if (include.error) return { filters: null, error: include.error };

  return {
    filters: {
      ids,
      query: normalizeText(query("q") ?? ""),
      countries: countries.values,
      types: types.values,
      operators: operatorSlugs,
      includeStops: include.values.includes("stops"),
    },
    error: null,
  };
}

function matchesQuery(line: Line, query: string): boolean {
  return [line.id, line.code, line.name, ...line.routes.map((route) => route.code)].some(
    (value) => value && normalizeText(value).includes(query),
  );
}

/** Filters intersect and keep the order of the supplied collection; comma values use OR. */
export function filterLines(source: readonly Line[], filters: LineFilters): Line[] {
  return source.filter((line) => {
    if (filters.ids.length > 0 && !filters.ids.includes(line.id)) return false;
    if (filters.query && !matchesQuery(line, filters.query)) return false;
    if (filters.countries.length > 0 && !filters.countries.includes(line.id.slice(0, 2))) {
      return false;
    }
    if (filters.types.length > 0 && !filters.types.includes(line.type)) return false;
    if (filters.operators.length > 0 && !filters.operators.includes(line.operator ?? "")) {
      return false;
    }
    return true;
  });
}

/** Read one line's track from the ASSETS binding; a missing or invalid file is a deployment fault. */
async function loadLineGeometry(assets: Fetcher, line: Line): Promise<LineGeometry | null> {
  // The path comes only from a canonical line ID, never from request input.
  const response = await assets.fetch(new URL(`/${line.id}.json`, "https://assets.invalid"));
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Line geometry asset unavailable for ${line.id} (${response.status})`);
  }

  const geometry = validateLineGeometry(JSON.parse(await response.text()), line.id);
  return geometry.coordinates.length > 0 ? geometry : null;
}

/**
 * Each line's Feature, serialized once per isolate: tracks only change with a deploy, so a
 * cache miss joins strings instead of parsing and validating up to 1.8 MB of track again.
 * Only finished strings are kept; a pending read can't be shared across requests.
 */
const featureJsonById = new Map<string, string>();

async function lineFeatureJson(assets: Fetcher, line: Line): Promise<string> {
  const cached = featureJsonById.get(line.id);
  if (cached !== undefined) return cached;

  const geometry = await loadLineGeometry(assets, line);
  const json = JSON.stringify({ type: "Feature", id: line.id, properties: line, geometry });
  featureJsonById.set(line.id, json);
  return json;
}

/**
 * A FeatureCollection with one Feature per line and its whole track (null for lines without
 * mapped track), plus `members` as GeoJSON foreign members (RFC 7946 §6.1).
 */
export async function lineFeatureCollectionJson(
  assets: Fetcher,
  selected: readonly Line[],
  members: object | null,
): Promise<string> {
  const features = await Promise.all(selected.map((line) => lineFeatureJson(assets, line)));
  // The members object without its braces, appended after `features`.
  const extra = members ? JSON.stringify(members).slice(1, -1) : "";

  return `{"type":"FeatureCollection","features":[${features.join(",")}]${extra && `,${extra}`}}`;
}

/** The registry entry of every stop on the selected lines, so a client can draw them without it. */
export function getLineStops(selected: readonly Line[]): LineStops {
  const selectedIds = new Set(selected.map((line) => line.id));
  const stops: Record<string, LineStop> = {};
  const connections = new Map<string, LineSummary>();

  for (const line of selected) {
    for (const stationId of getLineStationIds(line)) {
      if (stops[stationId]) continue;
      const station = stationById.get(stationId);
      if (!station) throw new Error(`Line ${line.id} stops at unknown station ${stationId}`);

      const serving = getStationLines(stationId);
      for (const { id, code, name, type, color } of serving) {
        if (!selectedIds.has(id)) connections.set(id, { id, code, name, type, color });
      }
      stops[stationId] = {
        name: station.name,
        type: station.type,
        importance: station.importance,
        geo: station.geo,
        lines: serving.map((other) => other.id),
      };
    }
  }

  return { stops, connections: [...connections.values()] };
}
