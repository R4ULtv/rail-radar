import type { Context } from "hono";
import { cache } from "hono/cache";

import { getStationLines, lines } from "@repo/data/lines";
import { stationById } from "@repo/data/stations";
import type { Line } from "@repo/data/types";

import { CACHE_TTL } from "../constants";
import { factory, type Env } from "../lib/env";
import { jsonError } from "../lib/http";
import {
  filterLines,
  getLineStops,
  loadLineFeatureCollection,
  parseLineFilters,
  type LineStops,
} from "../lib/line-data";

const linesCache = () => cache({ cacheName: "lines-cache", cacheControl: CACHE_TTL.LINES });

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

  const collection = await loadLineFeatureCollection(c.env.ASSETS, result.selected);
  // GeoJSON foreign members (RFC 7946 §6.1), ignored by clients that only read features.
  const body = { ...collection, ...result.stops };

  return c.body(JSON.stringify(body), 200, { "Content-Type": "application/geo+json" });
}

function stationNotFound(c: Context<Env>) {
  return jsonError(c, "Station not found. Please try searching for another station.", 404);
}

export const linesRoutes = factory.createApp().get("/", linesCache(), (c) => linesJson(c, lines));

export const linesGeoJsonRoutes = factory
  .createApp()
  .get("/", linesCache(), (c) => linesGeoJson(c, lines));

/** Station membership; mount after the stations routes so their fixed paths keep priority. */
export const stationLinesRoutes = factory
  .createApp()
  .get("/:id/lines", linesCache(), (c) => {
    if (!stationById.has(c.req.param("id"))) return stationNotFound(c);

    return linesJson(c, getStationLines(c.req.param("id")), true);
  })
  .get("/:id/lines.geojson", linesCache(), (c) => {
    if (!stationById.has(c.req.param("id"))) return stationNotFound(c);

    return linesGeoJson(c, getStationLines(c.req.param("id")), true);
  });
