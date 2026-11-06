import { createHash, createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PROVIDER_IDS,
  getAnalyticsOverview,
  getProviderByStationId,
  getStationStats,
  getTrendingStations,
  isProviderId,
  recordProviderMetric,
  recordStationVisit,
} from "../../src/analytics";
import { SCRAPER_COUNTRIES } from "../../src/scrapers";
import {
  analyticsQueries,
  createAnalyticsDataset,
  jsonResponse,
  mockAnalytics,
  mockFetch,
  textResponse,
} from "../helpers";

const ROW = {
  stationId: "IT1728",
  stationName: "Milano Centrale",
  country: "it",
  count: "42",
  uniqueVisitors: "30",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("recordStationVisit", () => {
  const visit = {
    stationId: "IT1728",
    stationName: "Milano Centrale",
    ip: "203.0.113.7",
    type: "departures",
    country: "it",
  };

  it("writes a data point with a keyed hash of the IP", async () => {
    const dataset = createAnalyticsDataset();

    await recordStationVisit(dataset as unknown as AnalyticsEngineDataset, visit, "pepper");

    const hash = createHmac("sha256", "pepper").update("203.0.113.7").digest("hex");
    expect(dataset.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["Milano Centrale", hash, "departures", "IT1728", "it"],
      doubles: [],
      indexes: ["IT1728"],
    });
  });

  it("never stores the raw IP", async () => {
    const dataset = createAnalyticsDataset();

    await recordStationVisit(dataset as unknown as AnalyticsEngineDataset, visit, "pepper");

    expect(JSON.stringify(dataset.writeDataPoint.mock.calls)).not.toContain("203.0.113.7");
  });

  it("falls back to an unkeyed hash and warns when no pepper is configured", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dataset = createAnalyticsDataset();

    await recordStationVisit(dataset as unknown as AnalyticsEngineDataset, visit, "");

    const hash = createHash("sha256").update("203.0.113.7").digest("hex");
    expect(dataset.writeDataPoint.mock.calls[0]![0].blobs[1]).toBe(hash);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("recordProviderMetric", () => {
  it("writes provider, outcome and timing", async () => {
    const dataset = createAnalyticsDataset();

    await recordProviderMetric(dataset as unknown as AnalyticsEngineDataset, {
      provider: "irail",
      source: "live",
      result: "success",
      requestType: "arrivals",
      stationId: "BE14001",
      country: "be",
      fetchMs: 123.4,
      statusCode: 200,
    });

    expect(dataset.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["irail", "live", "success", "arrivals", "BE14001", "be"],
      doubles: [123.4, 200],
      indexes: ["irail"],
    });
  });

  it("records missing timing and status as -1", async () => {
    const dataset = createAnalyticsDataset();

    await recordProviderMetric(dataset as unknown as AnalyticsEngineDataset, {
      provider: "irail",
      source: "live",
      result: "error",
      requestType: "departures",
      stationId: "BE14001",
      country: "be",
    });

    expect(dataset.writeDataPoint.mock.calls[0]![0].doubles).toEqual([-1, -1]);
  });
});

describe("provider mapping", () => {
  it("maps every scraper country to a known provider", () => {
    for (const country of SCRAPER_COUNTRIES) {
      const provider = getProviderByStationId(`${country.toUpperCase()}1`);
      expect(provider, country).not.toBeNull();
      expect(isProviderId(provider!)).toBe(true);
    }
  });

  it("maps station IDs by prefix", () => {
    expect(getProviderByStationId("IT1728")).toBe("rfi");
    expect(getProviderByStationId("CH03000")).toBe("opendata-ch");
    expect(getProviderByStationId("UK1")).toBe("nationalrail");
    expect(getProviderByStationId("HU1")).toBe("mav");
    expect(getProviderByStationId("XX1")).toBeNull();
  });

  it("recognises provider IDs", () => {
    expect(PROVIDER_IDS).toContain("db");
    expect(isProviderId("db")).toBe(true);
    expect(isProviderId("amtrak")).toBe(false);
  });
});

describe("getTrendingStations", () => {
  it("queries Analytics Engine with the account credentials", async () => {
    const fetchMock = mockFetch();
    mockAnalytics(fetchMock, [["FROM station_visits", [ROW]]]);

    await getTrendingStations("acct-1", "token-1");

    const [request] = fetchMock.requests;
    expect(request!.url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct-1/analytics_engine/sql",
    );
    expect(request!.method).toBe("POST");
    expect(request!.headers.get("Authorization")).toBe("Bearer token-1");
    expect(request!.headers.get("Content-Type")).toBe("text/plain");
  });

  it("maps rows and coerces numeric strings", async () => {
    const fetchMock = mockFetch();
    mockAnalytics(fetchMock, [
      ["FROM station_visits", [ROW, { ...ROW, stationId: "CH03000", country: "" }]],
    ]);

    await expect(getTrendingStations("acct", "token")).resolves.toEqual([
      {
        stationId: "IT1728",
        stationName: "Milano Centrale",
        country: "it",
        visits: 42,
        uniqueVisitors: 30,
      },
      // An empty country blob falls back to the station ID prefix.
      {
        stationId: "CH03000",
        stationName: "Milano Centrale",
        country: "ch",
        visits: 42,
        uniqueVisitors: 30,
      },
    ]);
  });

  it.each([
    ["hour", "INTERVAL '1' HOUR"],
    ["day", "INTERVAL '1' DAY"],
    ["week", "INTERVAL '7' DAY"],
    ["month", "INTERVAL '1' MONTH"],
  ] as const)("uses the %s interval", async (period, interval) => {
    const fetchMock = mockFetch();
    mockAnalytics(fetchMock, [["FROM station_visits", []]]);

    await getTrendingStations("acct", "token", period);

    expect(analyticsQueries(fetchMock)[0]).toContain(interval);
  });

  it("filters by country and orders by the requested metric", async () => {
    const fetchMock = mockFetch();
    mockAnalytics(fetchMock, [["FROM station_visits", []]]);

    await getTrendingStations("acct", "token", "day", 5, "de", "uniqueVisitors");

    const sql = analyticsQueries(fetchMock)[0]!;
    expect(sql).toContain("AND blob5 = 'de'");
    expect(sql).toContain("ORDER BY uniqueVisitors DESC, count DESC, stationId ASC");
  });

  it("orders by visits by default", async () => {
    const fetchMock = mockFetch();
    mockAnalytics(fetchMock, [["FROM station_visits", []]]);

    await getTrendingStations("acct", "token");

    const sql = analyticsQueries(fetchMock)[0]!;
    expect(sql).toContain("ORDER BY count DESC, uniqueVisitors DESC");
    expect(sql).not.toContain("blob5 =");
  });

  it.each([
    [0, 1],
    [3.9, 3],
    [500, 25],
    [Number.NaN, 5],
  ])("clamps the limit %s to %s", async (limit, expected) => {
    const fetchMock = mockFetch();
    mockAnalytics(fetchMock, [["FROM station_visits", []]]);

    await getTrendingStations("acct", "token", "day", limit);

    expect(analyticsQueries(fetchMock)[0]).toMatch(new RegExp(`LIMIT ${expected}\\s*$`));
  });

  it("rejects a country outside the allowlist before building SQL", async () => {
    const fetchMock = mockFetch();

    await expect(
      getTrendingStations("acct", "token", "day", 5, "it' OR 1=1 --" as never),
    ).rejects.toThrow("Invalid country code");
    expect(fetchMock.fetch).not.toHaveBeenCalled();
  });

  it.each([
    [401, "rejected access"],
    [403, "rejected access"],
    [429, "reached its request limit"],
    [500, "could not complete the query"],
  ])("explains HTTP %i failures", async (status, reason) => {
    mockFetch().on("api.cloudflare.com", textResponse("nope", { status }));

    await expect(getTrendingStations("acct", "token")).rejects.toThrow(
      `Cloudflare Analytics Engine ${reason} for trending stations (HTTP ${status}).`,
    );
  });

  it("explains network failures", async () => {
    mockFetch().fail();

    await expect(getTrendingStations("acct", "token")).rejects.toThrow(
      "Unable to connect to Cloudflare Analytics Engine for the trending stations query.",
    );
  });

  it("explains unreadable responses", async () => {
    mockFetch().on("api.cloudflare.com", textResponse("not json"));

    await expect(getTrendingStations("acct", "token")).rejects.toThrow(
      "Unable to read the Cloudflare Analytics Engine response for trending stations (HTTP 200).",
    );
  });
});

describe("getStationStats", () => {
  const cache = () => ({ match: vi.fn(async () => undefined), put: vi.fn(async () => {}) });

  it("rejects station IDs that could inject SQL", async () => {
    const fetchMock = mockFetch();

    await expect(getStationStats("acct", "token", "IT1' OR '1'='1")).rejects.toThrow(
      "Invalid station ID",
    );
    expect(fetchMock.fetch).not.toHaveBeenCalled();
  });

  it("returns the station's stats and the top station", async () => {
    const fetchMock = mockFetch();
    mockAnalytics(fetchMock, [
      ["index1 = 'CH03000'", [{ ...ROW, stationId: "CH03000", stationName: "Zürich HB" }]],
      ["LIMIT 1", [ROW]],
    ]);

    const result = await getStationStats("acct", "token", "CH03000", "week", cache());

    expect(result).toEqual({
      station: {
        stationId: "CH03000",
        stationName: "Zürich HB",
        country: "ch",
        visits: 42,
        uniqueVisitors: 30,
      },
      topStation: {
        stationId: "IT1728",
        stationName: "Milano Centrale",
        country: "it",
        visits: 42,
        uniqueVisitors: 30,
      },
    });
    const queries = analyticsQueries(fetchMock);
    expect(queries).toHaveLength(2);
    expect(queries.every((sql) => sql.includes("INTERVAL '7' DAY"))).toBe(true);
  });

  it("returns nulls when there are no visits", async () => {
    const fetchMock = mockFetch();
    mockAnalytics(fetchMock, [["FROM station_visits", []]]);

    await expect(getStationStats("acct", "token", "CH03000", "day", cache())).resolves.toEqual({
      station: null,
      topStation: null,
    });
  });

  it("reuses a cached top station instead of querying it", async () => {
    const fetchMock = mockFetch();
    mockAnalytics(fetchMock, [["index1 = 'CH03000'", []]]);
    const cached = {
      match: vi.fn(async () =>
        jsonResponse({
          stationId: "IT1728",
          stationName: "Milano Centrale",
          country: "it",
          visits: 1,
          uniqueVisitors: 1,
        }),
      ),
      put: vi.fn(),
    };

    const result = await getStationStats("acct", "token", "CH03000", "day", cached);

    expect(result.topStation?.stationId).toBe("IT1728");
    expect(analyticsQueries(fetchMock)).toHaveLength(1);
  });

  it("loads the top station directly when the Cache API is unavailable", async () => {
    const fetchMock = mockFetch();
    mockAnalytics(fetchMock, [
      ["index1 = 'CH03000'", []],
      ["LIMIT 1", [ROW]],
    ]);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => {
        throw new Error("no cache");
      }),
    });

    const result = await getStationStats("acct", "token", "CH03000");

    expect(result.topStation?.stationId).toBe("IT1728");
  });
});

describe("getAnalyticsOverview", () => {
  it("combines the totals and the per-country breakdown", async () => {
    const fetchMock = mockFetch();
    mockAnalytics(fetchMock, [
      [
        "GROUP BY blob5",
        [
          { country: "it", visits: "10", uniqueVisitors: "7", stationsVisited: "3" },
          { country: "ch", visits: 4, uniqueVisitors: 2, stationsVisited: 1 },
        ],
      ],
      [
        "totalVisits",
        [
          {
            totalVisits: 14,
            uniqueVisitors: 9,
            arrivalsCount: 5,
            departuresCount: 9,
            stationsVisited: 4,
          },
        ],
      ],
    ]);

    await expect(getAnalyticsOverview("acct", "token")).resolves.toEqual({
      totalVisits: 14,
      uniqueVisitors: 9,
      arrivalsCount: 5,
      departuresCount: 9,
      stationsVisited: 4,
      countries: [
        { country: "it", visits: 10, uniqueVisitors: 7, stationsVisited: 3 },
        { country: "ch", visits: 4, uniqueVisitors: 2, stationsVisited: 1 },
      ],
    });
  });

  it("returns zeros when there is no data", async () => {
    const fetchMock = mockFetch();
    mockAnalytics(fetchMock, [["FROM station_visits", []]]);

    await expect(getAnalyticsOverview("acct", "token")).resolves.toEqual({
      totalVisits: 0,
      uniqueVisitors: 0,
      arrivalsCount: 0,
      departuresCount: 0,
      stationsVisited: 0,
      countries: [],
    });
  });

  it("fails when either query fails", async () => {
    const fetchMock = mockFetch();
    fetchMock.on("api.cloudflare.com", (request) =>
      request.body?.includes("GROUP BY blob5")
        ? textResponse("", { status: 500 })
        : jsonResponse({ data: [] }),
    );

    await expect(getAnalyticsOverview("acct", "token")).rejects.toThrow("country breakdown");
  });
});
