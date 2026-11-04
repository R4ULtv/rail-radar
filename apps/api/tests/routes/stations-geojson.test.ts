import { describe, expect, it } from "vitest";

import { getCountry } from "@repo/data/countries";
import { stationsGeoJSON } from "@repo/data/stations";
import type { StationFeatureCollection } from "@repo/data/types";

import { CACHE_TTL } from "../../src/constants";
import { request } from "../helpers/app";

async function get(query = "") {
  const { response } = await request(`/stations.geojson${query}`);
  return response;
}

describe("GET /stations.geojson", () => {
  it("returns every station as GeoJSON", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/geo+json");
    expect(response.headers.get("Cache-Control")).toBe(CACHE_TTL.GEOJSON);
    const body = (await response.json()) as StationFeatureCollection;
    expect(body.type).toBe("FeatureCollection");
    expect(body.features).toHaveLength(stationsGeoJSON.features.length);
  });

  it("filters by type", async () => {
    const body = (await (await get("?type=metro")).json()) as StationFeatureCollection;

    expect(body.features.length).toBeGreaterThan(0);
    expect(body.features.every((f) => f.properties.type === "metro")).toBe(true);
  });

  it("filters by country, including metro and light-rail prefixes", async () => {
    const body = (await (await get("?country=ch")).json()) as StationFeatureCollection;

    expect(body.features.length).toBe(
      stationsGeoJSON.features.filter((f) => getCountry(f.properties.id) === "ch").length,
    );
    expect(body.features.some((f) => f.properties.id.startsWith("CHM"))).toBe(true);
  });

  it("combines type and country filters", async () => {
    const body = (await (await get("?type=rail&country=be")).json()) as StationFeatureCollection;

    expect(body.features.length).toBeGreaterThan(0);
    for (const { properties } of body.features) {
      expect(properties.type).toBe("rail");
      expect(getCountry(properties.id)).toBe("be");
    }
  });

  it("rejects an unknown type", async () => {
    const response = await get("?type=bus");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid type. Must be "rail", "metro", "light", or "freight".',
    });
  });

  it("rejects an unknown country", async () => {
    const response = await get("?country=es");

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toMatch(/^Invalid country\./);
  });
});
