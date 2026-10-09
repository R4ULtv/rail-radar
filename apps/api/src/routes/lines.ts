import type { Context } from "hono";
import { cache } from "hono/cache";

import { getStationLines, lines } from "@repo/data/lines";
import { stationById } from "@repo/data/stations";
import type { Line } from "@repo/data/types";

import { CACHE_TTL } from "../constants";
import { factory, type Env } from "../lib/env";
import { jsonError } from "../lib/http";
import { filterLines, loadLineFeatureCollection, parseLineFilters } from "../lib/line-data";

const linesCache = () => cache({ cacheName: "lines-cache", cacheControl: CACHE_TTL.LINES });

/** Apply the shared filters to a collection, or return the 400 response for an invalid filter. */
function selectLines(c: Context<Env>, source: readonly Line[]): Line[] | Response {
  const parsed = parseLineFilters((name) => c.req.query(name));
  if (parsed.error !== null) return jsonError(c, parsed.error, 400);

  return filterLines(source, parsed.filters);
}

function linesJson(c: Context<Env>, source: readonly Line[]) {
  const selected = selectLines(c, source);
  if (selected instanceof Response) return selected;

  return c.json({ count: selected.length, lines: selected });
}

async function linesGeoJson(c: Context<Env>, source: readonly Line[]) {
  const selected = selectLines(c, source);
  if (selected instanceof Response) return selected;

  const collection = await loadLineFeatureCollection(c.env.ASSETS, selected);

  return c.body(JSON.stringify(collection), 200, { "Content-Type": "application/geo+json" });
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

    return linesJson(c, getStationLines(c.req.param("id")));
  })
  .get("/:id/lines.geojson", linesCache(), (c) => {
    if (!stationById.has(c.req.param("id"))) return stationNotFound(c);

    return linesGeoJson(c, getStationLines(c.req.param("id")));
  });
