import type { Context } from "hono";
import { cache } from "hono/cache";

import { getStationLines, lines } from "@repo/data/lines";
import { stationById } from "@repo/data/stations";
import type { Line } from "@repo/data/types";

import { CACHE_TTL } from "../constants";
import { factory, type Env } from "../lib/env";
import { jsonError, parseFilterList } from "../lib/http";
import {
  filterLines,
  getLineStops,
  lineFeatureCollectionJson,
  normalizeText,
  parseLineFilters,
  type LineStops,
} from "../lib/line-data";
import { rateLimit } from "../middleware/rate-limit";

const LIST_FILTERS = ["id", "country", "type", "operator", "include"] as const;

/**
 * The request as the filters read it: unknown parameters dropped, list values sorted and
 * deduplicated, so extra or reordered parameters can't be used to skip the cache.
 */
function linesCacheKey(c: Context<Env>): string {
  const url = new URL(c.req.url);
  const key = new URLSearchParams();
  for (const name of LIST_FILTERS) {
    const values = [...new Set(parseFilterList(c.req.query(name)))].sort();
    if (values.length > 0) key.set(name, values.join(","));
  }
  const query = normalizeText(c.req.query("q") ?? "");
  if (query) key.set("q", query);

  return `${url.origin}${url.pathname}?${key}`;
}

const linesCache = () =>
  cache({ cacheName: "lines-cache", cacheControl: CACHE_TTL.LINES, keyGenerator: linesCacheKey });

/**
 * Apply the shared filters to a collection, or return the 400 response for an invalid filter.
 * Stops come with `include=stops`, or always when `withStops` is set (the station routes).
 */
function selectLines(
  c: Context<Env>,
  source: readonly Line[],
  withStops: boolean,
): { selected: Line[]; stops: LineStops | null } | Response {
  const parsed = parseLineFilters((name) => c.req.query(name));
  if (parsed.error !== null) return jsonError(c, parsed.error, 400);

  const selected = filterLines(source, parsed.filters);
  const stops = withStops || parsed.filters.includeStops ? getLineStops(selected) : null;
  return { selected, stops };
}

function linesJson(c: Context<Env>, source: readonly Line[], withStops = false) {
  const result = selectLines(c, source, withStops);
  if (result instanceof Response) return result;

  return c.json({ count: result.selected.length, lines: result.selected, ...result.stops });
}

async function linesGeoJson(c: Context<Env>, source: readonly Line[], withStops = false) {
  const result = selectLines(c, source, withStops);
  if (result instanceof Response) return result;

  const body = await lineFeatureCollectionJson(c.env.ASSETS, result.selected, result.stops);

  return c.body(body, 200, { "Content-Type": "application/geo+json" });
}

function stationNotFound(c: Context<Env>) {
  return jsonError(c, "Station not found. Please try searching for another station.", 404);
}

// Each route checks the cache before the rate limit: cached responses are free, and only
// building a new one counts against the client's request budget.
export const linesRoutes = factory
  .createApp()
  .get("/", linesCache(), rateLimit, (c) => linesJson(c, lines));

export const linesGeoJsonRoutes = factory
  .createApp()
  .get("/", linesCache(), rateLimit, (c) => linesGeoJson(c, lines));

/** Station membership; mount after the stations routes so their fixed paths keep priority. */
export const stationLinesRoutes = factory
  .createApp()
  .get("/:id/lines", linesCache(), rateLimit, (c) => {
    if (!stationById.has(c.req.param("id"))) return stationNotFound(c);

    return linesJson(c, getStationLines(c.req.param("id")), true);
  })
  .get("/:id/lines.geojson", linesCache(), rateLimit, (c) => {
    if (!stationById.has(c.req.param("id"))) return stationNotFound(c);

    return linesGeoJson(c, getStationLines(c.req.param("id")), true);
  });
