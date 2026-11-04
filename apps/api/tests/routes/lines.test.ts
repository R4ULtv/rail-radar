import { describe, expect, it } from "vitest";

import { lines } from "@repo/data/lines";
import type { Line, LineGeometry } from "@repo/data/types";

import { CACHE_TTL } from "../../src/constants";
import type { LineStop, LineSummary } from "../../src/lib/line-data";
import { createEnv, createLineAssets, createRateLimiter } from "../helpers";
import { cachedKeys, request } from "../helpers/app";

type LinesBody = {
  count: number;
  lines: Line[];
  stops?: Record<string, LineStop>;
  connections?: LineSummary[];
  error?: string;
};
type LinesGeoJson = {
  type: "FeatureCollection";
  features: { type: "Feature"; id: string; properties: Line; geometry: LineGeometry | null }[];
  stops?: Record<string, LineStop>;
  connections?: LineSummary[];
};

const env = () => createEnv({ ASSETS: createLineAssets() });

async function getLines(query = "") {
  const { response } = await request(`/lines${query}`);
  return { response, body: (await response.json()) as LinesBody };
}

describe("GET /lines", () => {
  it("lists every line without track", async () => {
    const { response, body } = await getLines();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_TTL.LINES);
    expect(body.count).toBe(lines.length);
    expect(body.lines).toEqual(lines);
    expect(body).not.toHaveProperty("stops");
  });

  it("selects lines by ID, keeping registry order", async () => {
    const { body } = await getLines("?id=it-milano-m2,it-milano-m1");

    expect(body.lines.map((line) => line.id)).toEqual(["it-milano-m1", "it-milano-m2"]);
  });

  it("filters by country, type and operator together", async () => {
    const { body } = await getLines("?country=it&type=metro&operator=atm-milano");

    expect(body.lines.map((line) => line.id)).toEqual([
      "it-milano-m1",
      "it-milano-m2",
      "it-milano-m3",
      "it-milano-m4",
      "it-milano-m5",
    ]);
  });

  it("searches names ignoring case", async () => {
    const { body } = await getLines("?operator=atm-milano&q=METROPOLITANA%20M1");

    expect(body.lines.map((line) => line.id)).toEqual(["it-milano-m1"]);
  });

  it("searches names ignoring accents", async () => {
    const { body } = await getLines("?id=be-brussels-1,it-milano-m1&q=metro%201");

    expect(body.lines.map((line) => line.id)).toEqual(["be-brussels-1"]);
  });

  it("searches route codes", async () => {
    const { body } = await getLines("?q=27S");

    expect(body.lines.map((line) => line.id)).toContain("se-stockholm-27");
  });

  it("includes stops and interchanges on request", async () => {
    const { body } = await getLines("?id=it-milano-m1&include=stops");

    const stopIds = new Set(
      lines[lines.findIndex((l) => l.id === "it-milano-m1")]!.routes.flatMap((r) => r.stations),
    );
    expect(Object.keys(body.stops!).sort()).toEqual([...stopIds].sort());
    expect(body.stops!.ITM125).toMatchObject({
      name: "Duomo (Milano)",
      type: "metro",
      geo: { lat: expect.any(Number), lng: expect.any(Number) },
      lines: ["it-milano-m1", "it-milano-m3"],
    });
    expect(body.connections!.map((line) => line.id).sort()).toEqual([
      "it-milano-m2",
      "it-milano-m3",
      "it-milano-m4",
      "it-milano-m5",
    ]);
    expect(body.connections![0]).toEqual({
      id: expect.any(String),
      code: expect.any(String),
      name: expect.any(String),
      type: "metro",
      color: expect.any(String),
    });
  });

  it("does not list selected lines as connections", async () => {
    const { body } = await getLines("?id=it-milano-m1,it-milano-m3&include=stops");

    expect(body.connections!.map((line) => line.id)).not.toContain("it-milano-m3");
  });

  it.each([
    ["?id=it-milano-m99", "Invalid id. Must be known line IDs; see GET /lines."],
    ["?country=es", /^Invalid country\. Must be one of: /],
    ["?type=tram", "Invalid type. Must be one of: metro, light"],
    ["?operator=nope", "Invalid operator. Must be a known operator slug; see GET /operators."],
    ["?include=track", "Invalid include. Must be one of: stops"],
  ])("rejects %s", async (query, error) => {
    const { response, body } = await getLines(query);

    expect(response.status).toBe(400);
    expect(body.error).toMatch(error);
  });

  it("normalises the cache key so reordered or extra parameters share an entry", async () => {
    await request("/lines?type=metro&country=IT,it&utm=1&q=%20M1");
    await request("/lines?q=m1&country=it&type=metro");

    expect(cachedKeys("lines-cache")).toHaveLength(1);
  });

  it("checks the cache before the rate limit", async () => {
    await request("/lines?country=it");
    const limited = createEnv({ RATE_LIMITER: createRateLimiter(false) });

    const { response } = await request("/lines?country=it", {}, limited);

    expect(response.status).toBe(200);
    expect(limited.RATE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it("rate limits uncached requests", async () => {
    const limited = createEnv({ RATE_LIMITER: createRateLimiter(false) });

    const { response } = await request("/lines?country=ch", {}, limited);

    expect(response.status).toBe(429);
  });
});

describe("GET /lines.geojson", () => {
  it("returns one feature per line with its full track", async () => {
    const { response } = await request("/lines.geojson?id=it-milano-m1", {}, env());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/geo+json");
    const body = (await response.json()) as LinesGeoJson;
    expect(body.type).toBe("FeatureCollection");
    expect(body.features).toHaveLength(1);
    expect(body.features[0]).toMatchObject({
      type: "Feature",
      id: "it-milano-m1",
      properties: { id: "it-milano-m1", code: "M1" },
      geometry: { type: "MultiLineString" },
    });
    expect(body.features[0]!.geometry!.coordinates.length).toBeGreaterThan(0);
    expect(body).not.toHaveProperty("stops");
  });

  it("adds stops and connections as foreign members on request", async () => {
    const { response } = await request("/lines.geojson?id=it-milano-m1&include=stops", {}, env());

    const body = (await response.json()) as LinesGeoJson;
    expect(body.stops?.ITM125).toBeDefined();
    expect(body.connections?.length).toBeGreaterThan(0);
  });

  it("fails loudly when a track asset is missing", async () => {
    const { captureLogs } = await import("../helpers");
    const logs = captureLogs();

    // An empty ASSETS binding answers 404 for every track file.
    const { response } = await request("/lines.geojson?id=it-milano-m4");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    expect(logs.errors()[0]).toMatchObject({ message: "Unhandled API error" });
  });

  it("validates filters before reading assets", async () => {
    const assetsEnv = env();

    const { response } = await request("/lines.geojson?type=bus", {}, assetsEnv);

    expect(response.status).toBe(400);
    expect(assetsEnv.ASSETS.fetch).not.toHaveBeenCalled();
  });
});

describe("GET /stations/:id/lines", () => {
  it("lists the lines serving a station, always with stops", async () => {
    const { response } = await request("/stations/ITM125/lines");

    const body = (await response.json()) as LinesBody;
    expect(body.lines.map((line) => line.id)).toEqual(["it-milano-m1", "it-milano-m3"]);
    expect(body.stops?.ITM125).toBeDefined();
    expect(body.connections).toBeDefined();
  });

  it("applies the shared filters", async () => {
    const { response } = await request("/stations/ITM125/lines?q=m3");

    expect(((await response.json()) as LinesBody).lines.map((line) => line.id)).toEqual([
      "it-milano-m3",
    ]);
  });

  it("returns an empty list for a station without lines", async () => {
    const { response } = await request("/stations/BEM042/lines");

    expect(await response.json()).toEqual({ count: 0, lines: [], stops: {}, connections: [] });
  });

  it("returns 404 for an unknown station", async () => {
    const { response } = await request("/stations/ITM999999/lines");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Station not found. Please try searching for another station.",
    });
  });

  it("returns the station's lines as GeoJSON", async () => {
    const { response } = await request("/stations/ITM125/lines.geojson", {}, env());

    const body = (await response.json()) as LinesGeoJson;
    expect(response.headers.get("Content-Type")).toBe("application/geo+json");
    expect(body.features.map((feature) => feature.id)).toEqual(["it-milano-m1", "it-milano-m3"]);
    expect(body.stops?.ITM125).toBeDefined();
  });

  it("returns 404 GeoJSON requests for an unknown station", async () => {
    const { response } = await request("/stations/ITM999999/lines.geojson", {}, env());

    expect(response.status).toBe(404);
  });
});
