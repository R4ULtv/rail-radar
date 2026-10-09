import { COUNTRY_CODES } from "@repo/data/countries";
import { validateLineGeometry } from "@repo/data/lines";
import { operators } from "@repo/data/operators";
import type { Line, LineGeometry } from "@repo/data/types";

import { parseFilterList, validateFilter } from "./http";

const LINE_TYPES = ["metro", "light"] as const satisfies readonly Line["type"][];
const OPERATOR_SLUGS = operators.map((operator) => operator.slug);
const DIACRITICS_REGEX = /[\u0300-\u036f]/g;

export type LineFilters = {
  query: string;
  countries: string[];
  types: Line["type"][];
  operators: string[];
};

export type LineFeature = {
  type: "Feature";
  id: string;
  properties: Line;
  geometry: LineGeometry | null;
};
export type LineFeatureCollection = { type: "FeatureCollection"; features: LineFeature[] };

function normalizeText(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS_REGEX, "").toLowerCase().trim();
}

/** Validate the shared q/country/type/operator filters; empty values mean no filter. */
export function parseLineFilters(
  query: (name: string) => string | undefined,
): { filters: LineFilters; error: null } | { filters: null; error: string } {
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

  return {
    filters: {
      query: normalizeText(query("q") ?? ""),
      countries: countries.values,
      types: types.values,
      operators: operatorSlugs,
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

/** One Feature per line, with its whole track; lines without mapped track get null geometry. */
export async function loadLineFeatureCollection(
  assets: Fetcher,
  selected: readonly Line[],
): Promise<LineFeatureCollection> {
  const features = await Promise.all(
    selected.map(async (line): Promise<LineFeature> => ({
      type: "Feature",
      id: line.id,
      properties: line,
      geometry: await loadLineGeometry(assets, line),
    })),
  );

  return { type: "FeatureCollection", features };
}
