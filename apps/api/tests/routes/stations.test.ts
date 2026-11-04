import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CACHE_TTL } from "../../src/constants";
import { STATION_STATS_CACHE_CONTROL } from "../../src/lib/top-station-cache";
import {
  analyticsQueries,
  captureLogs,
  createEnv,
  createRateLimiter,
  epochSecondsFromNow,
  freezeTime,
  jsonResponse,
  mockAnalytics,
  mockFetch,
  textResponse,
  type FetchMock,
} from "../helpers";
import { cachedKeys, request } from "../helpers/app";

// Brussels-South: a rail station served by the iRail scraper.
const BE_STATION = "BE14001";
const BE_NAME = "Brussel-Zuid/Bruxelles-Midi";

let fetchMock: FetchMock;

beforeEach(() => {
  freezeTime("2026-03-10T09:00:00.000Z");
  fetchMock = mockFetch();
});

afterEach(() => {
  vi.useRealTimers();
});

function irailBoard(count = 1) {
  return {
    departures: {
      departure: Array.from({ length: count }, (_, i) => ({
        station: "Antwerp-Central",
        time: String(epochSecondsFromNow(20 + i)),
        delay: "0",
        canceled: "0",
        left: "0",
        vehicle: `BE.NMBS.IC${2000 + i}`,
        vehicleinfo: { shortname: `IC ${2000 + i}`, number: String(2000 + i), type: "IC" },
        platform: "3",
        platforminfo: { name: "3", normal: "1" },
      })),
    },
  };
}

describe("rate limiting", () => {
  it("rejects requests over the per-IP budget with Retry-After", async () => {
    const env = createEnv({ RATE_LIMITER: createRateLimiter(false) });

    const { response } = await request("/stations/search?q=roma", {}, env);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("10");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: "Too many requests. Please wait a moment and try again.",
    });
  });

  it("keys the budget by client IP", async () => {
    const { env } = await request("/stations/search?q=roma", { ip: "198.51.100.1" });

    expect(env.RATE_LIMITER.limit).toHaveBeenCalledWith({ key: "198.51.100.1" });
  });

  it("shares one budget for requests without a client IP", async () => {
    const { env } = await request("/stations/search?q=roma", { ip: null });

    expect(env.RATE_LIMITER.limit).toHaveBeenCalledWith({ key: "unknown" });
  });
});

describe("GET /stations/search", () => {
  it("returns matching stations, best first", async () => {
    const { response } = await request("/stations/search?q=milano%20centrale");

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string }[];
    expect(body[0]).toMatchObject({ id: "IT1728", name: "Milano Centrale", type: "rail" });
    expect(body.length).toBeLessThanOrEqual(20);
  });

  it("finds a station by exact ID", async () => {
    const { response } = await request(`/stations/search?q=${BE_STATION.toLowerCase()}`);

    expect(((await response.json()) as { id: string }[])[0]?.id).toBe(BE_STATION);
  });

  it("returns an empty list without a query", async () => {
    const { response } = await request("/stations/search");

    expect(await response.json()).toEqual([]);
  });

  it("sets the search cache lifetime and stores the response", async () => {
    const { response } = await request("/stations/search?q=roma");

    expect(response.headers.get("Cache-Control")).toBe(CACHE_TTL.SEARCH);
    expect(cachedKeys("search-cache")).toEqual([
      "https://api.railradar24.com/stations/search?q=roma",
    ]);
  });

  it("serves repeated searches from the cache", async () => {
    await request("/stations/search?q=roma");
    const [key] = cachedKeys("search-cache");
    const cache = await caches.open("search-cache");
    await cache.put(
      key!,
      jsonResponse([{ id: "CACHED" }], { headers: { "Cache-Control": CACHE_TTL.SEARCH } }),
    );

    const { response } = await request("/stations/search?q=roma");

    expect(await response.json()).toEqual([{ id: "CACHED" }]);
  });

  it("bypasses the cache for authorized requests", async () => {
    await request("/stations/search?q=roma", { headers: { Authorization: "Bearer x" } });

    expect(cachedKeys("search-cache")).toHaveLength(0);
  });

  it("still answers when the cache is unavailable, and logs a warning", async () => {
    const logs = captureLogs();
    vi.stubGlobal("caches", {
      open: vi.fn(async () => {
        throw new Error("cache down");
      }),
    });

    const { response } = await request("/stations/search?q=roma");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_TTL.SEARCH);
    expect(logs.warnings()[0]).toMatchObject({
      message: "Station search cache lookup failed. Serving fresh search results.",
      cacheOperation: "lookup",
    });
  });

  it("still answers when writing to the cache fails, and logs a warning", async () => {
    const logs = captureLogs();
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({
        match: vi.fn(async () => undefined),
        put: vi.fn(async () => {
          throw new Error("quota");
        }),
      })),
    });

    const { response } = await request("/stations/search?q=roma");

    expect(response.status).toBe(200);
    expect(logs.warnings()[0]).toMatchObject({ cacheOperation: "put" });
  });
});

describe("GET /stations/trending", () => {
  const TRENDING_ROW = {
    stationId: "IT1728",
    stationName: "Milano Centrale",
    country: "it",
    count: 50,
    uniqueVisitors: 40,
  };

  it("returns trending stations with map data, ranked by unique visitors", async () => {
    mockAnalytics(fetchMock, [["FROM station_visits", [TRENDING_ROW]]]);

    const { response } = await request("/stations/trending");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_TTL.ANALYTICS);
    expect(await response.json()).toEqual({
      timestamp: "2026-03-10T09:00:00.000Z",
      period: "day",
      stations: [
        {
          stationId: "IT1728",
          stationName: "Milano Centrale",
          country: "it",
          visits: 50,
          uniqueVisitors: 40,
          geo: { lat: expect.any(Number), lng: expect.any(Number) },
          type: "rail",
          importance: 1,
        },
      ],
    });
    const [sql] = analyticsQueries(fetchMock);
    expect(sql).toContain("ORDER BY uniqueVisitors DESC");
    expect(sql).toMatch(/LIMIT 5\s*$/);
  });

  it("falls back to defaults for stations missing from the registry", async () => {
    mockAnalytics(fetchMock, [["FROM station_visits", [{ ...TRENDING_ROW, stationId: "IT0" }]]]);

    const { response } = await request("/stations/trending");

    expect(((await response.json()) as { stations: unknown[] }).stations[0]).toMatchObject({
      geo: null,
      type: "rail",
      importance: 4,
    });
  });

  it("accepts a period", async () => {
    mockAnalytics(fetchMock, [["FROM station_visits", []]]);

    const { response } = await request("/stations/trending?period=week");

    expect(await response.json()).toMatchObject({ period: "week", stations: [] });
    expect(analyticsQueries(fetchMock)[0]).toContain("INTERVAL '7' DAY");
  });

  it("rejects an unknown period", async () => {
    const { response } = await request("/stations/trending?period=year");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid period. Must be one of: hour, day, week, month",
    });
  });

  it("hides analytics failures behind a generic 500", async () => {
    const logs = captureLogs();
    fetchMock.on("api.cloudflare.com", textResponse("", { status: 500 }));

    const { response } = await request("/stations/trending");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to fetch analytics data. Please try again later.",
    });
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
    expect(logs.errors()[0]).toMatchObject({
      message: "Trending stations query failed",
      period: "day",
    });
    expect(cachedKeys("analytics-cache")).toHaveLength(0);
  });

  it("filters by country", async () => {
    mockAnalytics(fetchMock, [["FROM station_visits", [TRENDING_ROW]]]);

    const { response } = await request("/stations/trending/it?period=hour");

    expect(await response.json()).toMatchObject({ country: "it", period: "hour" });
    expect(analyticsQueries(fetchMock)[0]).toContain("AND blob5 = 'it'");
  });

  it("rejects an unknown country", async () => {
    const { response } = await request("/stations/trending/es");

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toMatch(/^Invalid country\./);
    expect(fetchMock.fetch).not.toHaveBeenCalled();
  });
});

describe("GET /stations/:id/stats", () => {
  function statsRows(station: object[], top: object[]) {
    mockAnalytics(fetchMock, [
      ["index1 = 'CH03000'", station],
      ["LIMIT 1", top],
    ]);
  }

  it("compares the station with the top station", async () => {
    statsRows(
      [{ stationId: "CH03000", stationName: "Zürich HB", count: 30, uniqueVisitors: 20 }],
      [
        {
          stationId: "IT1728",
          stationName: "Milano Centrale",
          country: "it",
          count: 90,
          uniqueVisitors: 60,
        },
      ],
    );

    const { response } = await request("/stations/CH03000/stats");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(STATION_STATS_CACHE_CONTROL);
    expect(await response.json()).toEqual({
      timestamp: "2026-03-10T09:00:00.000Z",
      period: "day",
      station: {
        stationId: "CH03000",
        stationName: "Zürich HB",
        country: "ch",
        visits: 30,
        uniqueVisitors: 20,
      },
      topStation: {
        stationId: "IT1728",
        stationName: "Milano Centrale",
        country: "it",
        visits: 90,
        uniqueVisitors: 60,
      },
      comparison: { percentage: 33.33, isTopStation: false },
    });
  });

  it("flags the top station itself", async () => {
    const row = {
      stationId: "CH03000",
      stationName: "Zürich HB",
      country: "ch",
      count: 5,
      uniqueVisitors: 5,
    };
    statsRows([row], [row]);

    const { response } = await request("/stations/CH03000/stats?period=month");

    expect(await response.json()).toMatchObject({
      period: "month",
      comparison: { percentage: 100, isTopStation: true },
    });
  });

  it("reports no comparison without visits", async () => {
    statsRows([], []);

    const { response } = await request("/stations/CH03000/stats");

    expect(await response.json()).toMatchObject({
      station: null,
      topStation: null,
      comparison: { percentage: null, isTopStation: false },
    });
  });

  it("returns 404 for an unknown station without querying analytics", async () => {
    const { response } = await request("/stations/CH99999999/stats");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Station not found. Please try searching for another station.",
    });
    expect(fetchMock.fetch).not.toHaveBeenCalled();
  });

  it("hides analytics failures behind a generic 500", async () => {
    const logs = captureLogs();
    fetchMock.fail();

    const { response } = await request("/stations/CH03000/stats");

    expect(response.status).toBe(500);
    expect(logs.errors()[0]).toMatchObject({
      message: "Station statistics query failed",
      stationId: "CH03000",
    });
  });
});

describe("GET /stations/:id", () => {
  it("returns the live board for a rail station", async () => {
    fetchMock.on("api.irail.be", jsonResponse(irailBoard(2)));

    const { response } = await request(`/stations/${BE_STATION}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_TTL.STATION_DATA);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      id: BE_STATION,
      name: BE_NAME,
      geo: { lat: expect.any(Number), lng: expect.any(Number) },
      timestamp: "2026-03-10T09:00:00.000Z",
      info: null,
      trains: [
        expect.objectContaining({ trainNumber: "2000", destination: "Antwerp-Central" }),
        expect.objectContaining({ trainNumber: "2001" }),
      ],
    });
    expect(fetchMock.url().searchParams.get("arrdep")).toBe("departure");
  });

  it("passes the board type to the scraper", async () => {
    fetchMock.on("api.irail.be", jsonResponse({ arrivals: { arrival: [] } }));

    const { response } = await request(`/stations/${BE_STATION}?type=arrivals`);

    expect(response.status).toBe(200);
    expect(fetchMock.url().searchParams.get("arrdep")).toBe("arrival");
  });

  it("records the visit with a hashed IP", async () => {
    fetchMock.on("api.irail.be", jsonResponse(irailBoard()));

    const { env } = await request(`/stations/${BE_STATION}?type=arrivals`, { ip: "192.0.2.5" });

    const hash = createHmac("sha256", "test-pepper").update("192.0.2.5").digest("hex");
    expect(env.STATION_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
      blobs: [BE_NAME, hash, "arrivals", BE_STATION, "be"],
      doubles: [],
      indexes: [BE_STATION],
    });
  });

  it("records a successful provider fetch", async () => {
    fetchMock.on("api.irail.be", jsonResponse(irailBoard()));

    const { env } = await request(`/stations/${BE_STATION}`);

    expect(env.PROVIDER_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["irail", "live", "success", "departures", BE_STATION, "be"],
      doubles: [expect.any(Number), 200],
      indexes: ["irail"],
    });
  });

  it("serves a cached board without calling the provider, but still counts the visit", async () => {
    fetchMock.on("api.irail.be", jsonResponse(irailBoard()));
    await request(`/stations/${BE_STATION}`);

    const { response, env } = await request(`/stations/${BE_STATION}`);

    expect(response.status).toBe(200);
    expect(fetchMock.requests.filter((r) => r.url.includes("irail"))).toHaveLength(1);
    expect(env.STATION_ANALYTICS.writeDataPoint).toHaveBeenCalledOnce();
    expect(env.PROVIDER_ANALYTICS.writeDataPoint).not.toHaveBeenCalled();
  });

  it("caches arrivals and departures separately", async () => {
    fetchMock.on("api.irail.be", jsonResponse(irailBoard()));

    await request(`/stations/${BE_STATION}`);
    await request(`/stations/${BE_STATION}?type=arrivals`);

    expect(fetchMock.requests).toHaveLength(2);
  });

  it("enforces the station-board budget per IP", async () => {
    const env = createEnv({ STATION_RATE_LIMITER: createRateLimiter(false) });

    const { response } = await request(`/stations/${BE_STATION}`, { ip: "192.0.2.9" }, env);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(env.STATION_RATE_LIMITER.limit).toHaveBeenCalledWith({
      key: "station-boards:192.0.2.9",
    });
    expect(fetchMock.fetch).not.toHaveBeenCalled();
    expect(env.STATION_ANALYTICS.writeDataPoint).not.toHaveBeenCalled();
  });

  it("rejects an invalid board type", async () => {
    const { response } = await request(`/stations/${BE_STATION}?type=both`);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid type. Must be "arrivals" or "departures".',
    });
  });

  it("returns 404 for an unknown station without recording a visit", async () => {
    const { response, env } = await request("/stations/BE99999999");

    expect(response.status).toBe(404);
    expect(env.STATION_ANALYTICS.writeDataPoint).not.toHaveBeenCalled();
  });

  it("rejects non-rail stations", async () => {
    const { response } = await request("/stations/BEM001");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Only rail stations are supported." });
    expect(fetchMock.fetch).not.toHaveBeenCalled();
  });

  it("passes provider errors through with their status and records them", async () => {
    const logs = captureLogs();
    fetchMock.on("api.irail.be", textResponse("", { status: 503 }));

    const { response, env } = await request(`/stations/${BE_STATION}`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error:
        "The Belgian train data source is temporarily unavailable (HTTP 503). Please try again.",
    });
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
    expect(env.PROVIDER_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["irail", "live", "error", "departures", BE_STATION, "be"],
      doubles: [expect.any(Number), 503],
      indexes: ["irail"],
    });
    expect(env.STATION_ANALYTICS.writeDataPoint).not.toHaveBeenCalled();
    expect(logs.errors()[0]).toMatchObject({
      message: "Station train data request failed",
      stationId: BE_STATION,
      provider: "irail",
      country: "be",
      status: 503,
      upstream: { host: "api.irail.be", status: 503 },
    });
    expect(cachedKeys("stations-cache")).toHaveLength(0);
  });

  it("records provider timeouts as timeouts", async () => {
    captureLogs();
    fetchMock.on("api.irail.be", textResponse("", { status: 504 }));

    const { response, env } = await request(`/stations/${BE_STATION}`);

    expect(response.status).toBe(504);
    expect(env.PROVIDER_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["irail", "live", "timeout", "departures", BE_STATION, "be"],
      doubles: [expect.any(Number), 504],
      indexes: ["irail"],
    });
  });

  it("hides unexpected scraper failures behind a generic 500", async () => {
    const logs = captureLogs();
    // A board entry without vehicle info makes the scraper throw a TypeError.
    fetchMock.on(
      "api.irail.be",
      jsonResponse({ departures: { departure: [{ time: String(epochSecondsFromNow(5)) }] } }),
    );

    const { response, env } = await request(`/stations/${BE_STATION}`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to load train data. Please try again in a moment.",
    });
    expect(env.PROVIDER_ANALYTICS.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["irail", "live", "error", "departures", BE_STATION, "be"],
      doubles: [-1, 500],
      indexes: ["irail"],
    });
    expect(logs.errors()[0]?.error).toMatchObject({ name: "TypeError" });
  });
});
