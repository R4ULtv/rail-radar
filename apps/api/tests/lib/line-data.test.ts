import { beforeEach, describe, expect, it, vi } from "vitest";

import { lineById, lines } from "@repo/data/lines";

import {
  filterLines,
  getLineStops,
  normalizeText,
  parseLineFilters,
  type LineFilters,
} from "../../src/lib/line-data";
import { createAssets } from "../helpers";

const NONE: LineFilters = {
  ids: [],
  query: "",
  countries: [],
  types: [],
  operators: [],
  includeStops: false,
};

const query = (params: Record<string, string>) => (name: string) => params[name];

describe("normalizeText", () => {
  it("strips accents, lowercases and trims", () => {
    expect(normalizeText("  Métro Ligne Ü ")).toBe("metro ligne u");
  });
});

describe("parseLineFilters", () => {
  it("returns empty filters by default", () => {
    expect(parseLineFilters(query({}))).toEqual({ filters: NONE, error: null });
  });

  it("parses every filter", () => {
    expect(
      parseLineFilters(
        query({
          id: "it-milano-m1",
          q: " Rhô ",
          country: "IT,ch",
          type: "metro",
          operator: "atm-milano",
          include: "stops",
        }),
      ),
    ).toEqual({
      filters: {
        ids: ["it-milano-m1"],
        query: "rho",
        countries: ["it", "ch"],
        types: ["metro"],
        operators: ["atm-milano"],
        includeStops: true,
      },
      error: null,
    });
  });

  it.each([
    [{ id: "nope" }, /^Invalid id\./],
    [{ country: "zz" }, /^Invalid country\./],
    [{ type: "bus" }, /^Invalid type\./],
    [{ operator: "nope" }, /^Invalid operator\./],
    [{ include: "track" }, /^Invalid include\./],
  ])("rejects %o", (params, error) => {
    const result = parseLineFilters(query(params));
    expect(result.filters).toBeNull();
    expect(result.error).toMatch(error);
  });
});

describe("filterLines", () => {
  it("returns the source unchanged without filters", () => {
    expect(filterLines(lines, NONE)).toEqual(lines);
  });

  it("intersects filters", () => {
    const result = filterLines(lines, { ...NONE, countries: ["it"], query: "m2" });
    expect(result.map((line) => line.id)).toEqual(["it-milano-m2"]);
  });

  it("filters by type", () => {
    const result = filterLines(lines, { ...NONE, types: ["light"] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((line) => line.type === "light")).toBe(true);
  });
});

describe("getLineStops", () => {
  it("throws when a line references an unknown station", () => {
    const broken = { ...lineById.get("it-milano-m1")!, routes: [{ stations: ["ITM000000"] }] };
    expect(() => getLineStops([broken])).toThrow("Line it-milano-m1 stops at unknown station");
  });

  it("returns nothing for no lines", () => {
    expect(getLineStops([])).toEqual({ stops: {}, connections: [] });
  });
});

describe("lineFeatureCollectionJson", () => {
  // The module memoises each line's feature for the isolate's lifetime; start every test cold.
  let lineFeatureCollectionJson: typeof import("../../src/lib/line-data").lineFeatureCollectionJson;

  beforeEach(async () => {
    vi.resetModules();
    ({ lineFeatureCollectionJson } = await import("../../src/lib/line-data"));
  });

  it("joins features and appends members", async () => {
    const line = lineById.get("it-milano-m2")!;
    const geometry = {
      type: "MultiLineString",
      coordinates: [
        [
          [9, 45],
          [9.1, 45.1],
        ],
      ],
    };
    const assets = createAssets({ "/it-milano-m2.json": geometry });

    const json = await lineFeatureCollectionJson(assets as unknown as Fetcher, [line], {
      stops: {},
    });

    expect(JSON.parse(json)).toEqual({
      type: "FeatureCollection",
      features: [{ type: "Feature", id: "it-milano-m2", properties: line, geometry }],
      stops: {},
    });
  });

  it("uses null geometry for lines without mapped track", async () => {
    const line = lineById.get("it-milano-m3")!;
    const assets = createAssets({
      "/it-milano-m3.json": { type: "MultiLineString", coordinates: [] },
    });

    const json = await lineFeatureCollectionJson(assets as unknown as Fetcher, [line], null);

    expect(JSON.parse(json).features[0].geometry).toBeNull();
  });

  it("reads each line's track once per isolate", async () => {
    const line = lineById.get("it-milano-m5")!;
    const assets = createAssets({
      "/it-milano-m5.json": {
        type: "MultiLineString",
        coordinates: [
          [
            [9, 45],
            [9, 46],
          ],
        ],
      },
    });

    await lineFeatureCollectionJson(assets as unknown as Fetcher, [line], null);
    await lineFeatureCollectionJson(assets as unknown as Fetcher, [line], null);

    expect(assets.fetch).toHaveBeenCalledOnce();
  });

  it("rejects missing or invalid track files", async () => {
    const missing = lineById.get("it-milano-m1")!;
    await expect(
      lineFeatureCollectionJson(createAssets() as unknown as Fetcher, [missing], null),
    ).rejects.toThrow("Line geometry asset unavailable for it-milano-m1 (404)");

    const invalid = lineById.get("it-milano-m4")!;
    const assets = createAssets({ "/it-milano-m4.json": { type: "Point" } });
    await expect(
      lineFeatureCollectionJson(assets as unknown as Fetcher, [invalid], null),
    ).rejects.toThrow();
  });
});
