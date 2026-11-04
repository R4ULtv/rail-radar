import { beforeEach, describe, expect, it, vi } from "vitest";

import { CACHE_TTL } from "../../src/constants";
import {
  captureLogs,
  createEnv,
  createRateLimiter,
  freezeTime,
  mockAnalytics,
  mockFetch,
  type FetchMock,
} from "../helpers";
import { request } from "../helpers/app";

let fetchMock: FetchMock;

beforeEach(() => {
  freezeTime("2026-03-10T09:00:00.000Z");
  fetchMock = mockFetch();
  return () => vi.useRealTimers();
});

describe("GET /analytics/overview", () => {
  it("returns the overview with a timestamp", async () => {
    mockAnalytics(fetchMock, [
      ["GROUP BY blob5", [{ country: "it", visits: 3, uniqueVisitors: 2, stationsVisited: 1 }]],
      [
        "totalVisits",
        [
          {
            totalVisits: 3,
            uniqueVisitors: 2,
            arrivalsCount: 1,
            departuresCount: 2,
            stationsVisited: 1,
          },
        ],
      ],
    ]);

    const { response } = await request("/analytics/overview");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_TTL.ANALYTICS);
    expect(await response.json()).toEqual({
      timestamp: "2026-03-10T09:00:00.000Z",
      totalVisits: 3,
      uniqueVisitors: 2,
      arrivalsCount: 1,
      departuresCount: 2,
      stationsVisited: 1,
      countries: [{ country: "it", visits: 3, uniqueVisitors: 2, stationsVisited: 1 }],
    });
    expect(fetchMock.requests[0]?.headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("hides analytics failures behind a generic 500", async () => {
    const logs = captureLogs();
    fetchMock.fail();

    const { response } = await request("/analytics/overview");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to fetch analytics data. Please try again later.",
    });
    expect(logs.errors()[0]).toMatchObject({ message: "Analytics overview query failed" });
  });

  it("is rate limited", async () => {
    const env = createEnv({ RATE_LIMITER: createRateLimiter(false) });

    const { response } = await request("/analytics/overview", {}, env);

    expect(response.status).toBe(429);
    expect(fetchMock.fetch).not.toHaveBeenCalled();
  });
});
