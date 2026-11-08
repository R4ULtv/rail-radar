import { beforeEach, describe, expect, it } from "vitest";

import { CACHE_TTL } from "../../src/constants";
import {
  captureLogs,
  createEnv,
  createRateLimiter,
  mockFetch,
  textResponse,
  type FetchMock,
} from "../helpers";
import { cachedKeys, request } from "../helpers/app";

let fetchMock: FetchMock;

function imageResponse() {
  return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/webp" } });
}

beforeEach(() => {
  fetchMock = mockFetch();
});

describe("GET /map/static", () => {
  it("renders a point map with the station marker", async () => {
    fetchMock.on("api.mapbox.com", imageResponse());

    const { response } = await request("/map/static?lat=45.4864&lng=9.2045&zoom=14&w=600&h=300");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toBe(CACHE_TTL.STATIC_MAP);
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);

    const url = fetchMock.url();
    expect(url.origin).toBe("https://api.mapbox.com");
    const marker = encodeURIComponent("https://www.railradar24.com/assets/maps/station-icon.png");
    expect(decodeURIComponent(url.pathname)).toBe(
      decodeURIComponent(
        `/styles/v1/mapbox/dark-v11/static/url-${marker}(9.2045,45.4864)/9.2045,45.4864,14,0/600x300@2x.webp`,
      ),
    );
    expect(url.searchParams.get("access_token")).toBe("test-mapbox-token");
    expect(url.searchParams.get("attribution")).toBe("false");
    expect(url.searchParams.get("logo")).toBe("false");
  });

  it("uses a public icon URL when running locally", async () => {
    fetchMock.on("api.mapbox.com", imageResponse());
    const { app } = await import("../../src/index");

    await app.request(
      "http://localhost:8787/map/static?lat=1&lng=2",
      { headers: { "cf-connecting-ip": "1.1.1.1" } },
      createEnv(),
      { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext,
    );

    expect(decodeURIComponent(fetchMock.url().pathname)).toContain(
      "url-https://www.railradar24.com/assets/maps/station-icon.png(2,1)",
    );
  });

  it("defaults point maps to 1280x256 at zoom 15", async () => {
    fetchMock.on("api.mapbox.com", imageResponse());

    await request("/map/static?lat=1&lng=2");

    expect(fetchMock.url().pathname).toMatch(/\/2,1,15,0\/1280x256@2x\.webp$/);
  });

  it("renders a bounding box with padding", async () => {
    fetchMock.on("api.mapbox.com", imageResponse());

    const { response } = await request("/map/static?bbox=9.1,45.4,9.3,45.5");

    expect(response.status).toBe(200);
    const url = fetchMock.url();
    expect(decodeURIComponent(url.pathname)).toBe(
      "/styles/v1/mapbox/dark-v11/static/[9.1,45.4,9.3,45.5]/960x412@2x.webp",
    );
    expect(url.searchParams.get("padding")).toBe("40");
  });

  it.each([
    ["?lat=1&lng=2&w=0", "Invalid dimensions. Max 1280x1280."],
    ["?lat=1&lng=2&h=1281", "Invalid dimensions. Max 1280x1280."],
    ["?bbox=1,2,3,4&w=2000", "Invalid dimensions. Max 1280x1280."],
    ["?lat=91&lng=2", "Invalid coordinates."],
    ["?lat=1&lng=-181", "Invalid coordinates."],
    ["?lat=abc&lng=2", "Invalid coordinates."],
    ["?lng=2", "Invalid coordinates."],
    ["?lat=1&lng=2&zoom=23", "Invalid zoom level."],
    ["?lat=1&lng=2&zoom=x", "Invalid zoom level."],
    ["?bbox=1,2,3", "Invalid bbox. Must be west,south,east,north."],
    ["?bbox=3,2,1,4", "Invalid bbox. Must be west,south,east,north."],
    ["?bbox=1,4,3,2", "Invalid bbox. Must be west,south,east,north."],
    ["?bbox=-190,2,3,4", "Invalid bbox. Must be west,south,east,north."],
    ["?bbox=1,-91,3,4", "Invalid bbox. Must be west,south,east,north."],
    ["?bbox=a,b,c,d", "Invalid bbox. Must be west,south,east,north."],
  ])("rejects %s", async (query, error) => {
    const { response } = await request(`/map/static${query}`);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
    expect(fetchMock.fetch).not.toHaveBeenCalled();
  });

  it("answers HEAD without generating an image", async () => {
    const { response, env } = await request("/map/static?lat=1&lng=2", { method: "HEAD" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(fetchMock.fetch).not.toHaveBeenCalled();
    expect(env.MAP_GENERATION_RATE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it("spends one generation allowance per upstream image", async () => {
    fetchMock.on("api.mapbox.com", imageResponse());

    const { env } = await request("/map/static?lat=1&lng=2", { ip: "192.0.2.1" });

    expect(env.MAP_GENERATION_RATE_LIMITER.limit).toHaveBeenCalledWith({
      key: "static-map:192.0.2.1",
    });
  });

  it("rejects image generation over budget", async () => {
    const env = createEnv({ MAP_GENERATION_RATE_LIMITER: createRateLimiter(false) });

    const { response } = await request("/map/static?lat=1&lng=2", {}, env);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchMock.fetch).not.toHaveBeenCalled();
  });

  it("serves equivalent requests from one cache entry", async () => {
    fetchMock.on("api.mapbox.com", imageResponse());

    await request("/map/static?lat=1.0&lng=2&zoom=15&w=1280&h=256&foo=bar");
    const { response } = await request("/map/static?lng=2&lat=1");

    expect(response.status).toBe(200);
    expect(fetchMock.requests).toHaveLength(1);
    expect(cachedKeys("static-map-webp-cache")).toHaveLength(1);
  });

  it("returns 502 when Mapbox fails, without leaking the token", async () => {
    const logs = captureLogs();
    fetchMock.on("api.mapbox.com", textResponse("bad token", { status: 401 }));

    const { response } = await request("/map/static?lat=1&lng=2");

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Failed to fetch map image." });
    expect(logs.errors()[0]).toMatchObject({
      message: "Map image request failed",
      provider: "mapbox",
      upstreamStatus: 401,
    });
    expect(JSON.stringify(logs.errors())).not.toContain("test-mapbox-token");
    expect(cachedKeys("static-map-webp-cache")).toHaveLength(0);
  });
});
