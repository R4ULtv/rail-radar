import { PROVIDERS } from "@repo/data/providers";
import type { StatusLatency, StatusSummary } from "@repo/data/status";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyticsQueries,
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

const counts = (provider: string, overrides = {}) => ({
  provider,
  requests: "100",
  successes: "100",
  errors: "0",
  timeouts: "0",
  samples: "100",
  lastSeen: "1773133140",
  ...overrides,
});

describe("GET /status/summary", () => {
  it("includes every configured provider, normalizes counts, and leaves quiet providers unknown", async () => {
    mockAnalytics(fetchMock, [
      [
        "FROM provider_metrics",
        [
          counts("rfi"),
          counts("db", { requests: "20", successes: "19", errors: "1", samples: "20" }),
        ],
      ],
    ]);
    const { response } = await request("/status/summary", {
      headers: { Origin: "https://status.railradar24.com" },
    });
    const body = (await response.json()) as StatusSummary;
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://status.railradar24.com",
    );
    expect(body.providers).toHaveLength(PROVIDERS.length);
    expect(body.providers.find((provider) => provider.id === "rfi")).toMatchObject({
      status: "operational",
      requests: 100,
      successRate: 1,
      lastSeen: "2026-03-10T08:59:00.000Z",
    });
    expect(body.providers.find((provider) => provider.id === "db")).toMatchObject({
      status: "degraded",
      successRate: 0.95,
    });
    expect(body.providers.find((provider) => provider.id === "entur")).toMatchObject({
      status: "unknown",
      requests: 0,
      successRate: null,
      lastSeen: null,
    });
    expect(body).toMatchObject({
      source: "live",
      scope: "provider-fetches",
      overall: "degraded",
      counts: { operational: 1, degraded: 1, outage: 0, unknown: 13 },
      window: { from: "2026-03-09T09:00:00.000Z", to: "2026-03-10T09:00:00.000Z", minutes: 1440 },
    });
    const sql = analyticsQueries(fetchMock)[0]!;
    expect(sql).toContain("blob2 = 'live'");
    expect(sql).toContain("sum(_sample_interval)");
    expect(sql).toContain("count() AS samples");
    expect(sql).toContain("timestamp >= toDateTime(1773046800)");
    expect(sql).toContain("timestamp < toDateTime(1773133200)");
  });

  it("keeps a quiet provider's observations from earlier in the day with their original freshness", async () => {
    const lastSeen = Date.parse("2026-03-09T15:00:00.000Z") / 1000;
    mockAnalytics(fetchMock, [
      [
        "FROM provider_metrics",
        [
          counts("rfi", {
            requests: 5,
            successes: 5,
            samples: 5,
            lastSeen,
          }),
        ],
      ],
    ]);
    const { response } = await request("/status/summary");
    const body = (await response.json()) as StatusSummary;
    expect(body.providers.find((provider) => provider.id === "rfi")).toMatchObject({
      status: "operational",
      requests: 5,
      samples: 5,
      lastSeen: "2026-03-09T15:00:00.000Z",
    });
    expect(body.window).toEqual({
      from: "2026-03-09T09:00:00.000Z",
      to: "2026-03-10T09:00:00.000Z",
      minutes: 1440,
    });
  });

  it("uses actual samples for confidence even when sampling weights indicate many requests", async () => {
    mockAnalytics(fetchMock, [
      [
        "FROM provider_metrics",
        [counts("rfi", { requests: 10_000, successes: 0, errors: 10_000, samples: 4 })],
      ],
    ]);
    const { response } = await request("/status/summary");
    const body = (await response.json()) as StatusSummary;
    expect(body.overall).toBe("unknown");
    expect(body.providers.find((provider) => provider.id === "rfi")).toMatchObject({
      status: "unknown",
      successRate: 0,
      samples: 4,
    });
  });

  it("counts timeouts as failures and includes the exact disruption threshold", async () => {
    mockAnalytics(fetchMock, [
      [
        "FROM provider_metrics",
        PROVIDERS.map((provider) =>
          counts(provider.id, { requests: 10, successes: 5, timeouts: 5, samples: 5 }),
        ),
      ],
    ]);
    const { response } = await request("/status/summary");
    const body = (await response.json()) as StatusSummary;
    expect(body.overall).toBe("outage");
    expect(body.counts.outage).toBe(PROVIDERS.length);
    expect(body.providers[0]).toMatchObject({ errors: 0, timeouts: 5, status: "outage" });
  });

  it("only reports operational overall when every provider has enough healthy observations", async () => {
    mockAnalytics(fetchMock, [
      ["FROM provider_metrics", PROVIDERS.map((provider) => counts(provider.id))],
    ]);
    const { response } = await request("/status/summary");
    expect(((await response.json()) as StatusSummary).overall).toBe("operational");
  });

  it("returns unknown for an empty dataset", async () => {
    mockAnalytics(fetchMock, [["FROM provider_metrics", []]]);
    const { response } = await request("/status/summary");
    const body = (await response.json()) as StatusSummary;
    expect(body.overall).toBe("unknown");
    expect(body.counts.unknown).toBe(PROVIDERS.length);
  });
});

describe("GET /status/latency", () => {
  it("returns exactly 30 UTC days including a partial today, preserving missing days as nulls", async () => {
    mockAnalytics(fetchMock, [
      [
        "quantileExactWeighted",
        [
          {
            provider: "rfi",
            date: "2026-03-09",
            p50: "100",
            p99: "250",
            p999: "400",
            latencySamples: "6",
            latencyRequests: "60",
          },
        ],
      ],
      [
        "FROM provider_metrics",
        [
          {
            ...counts("rfi", { requests: 70, successes: 60, errors: 0, timeouts: 10, samples: 7 }),
            date: "2026-03-09",
          },
        ],
      ],
    ]);
    const { response } = await request("/status/latency");
    const body = (await response.json()) as StatusLatency;
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(body).toMatchObject({
      source: "live",
      unit: "ms",
      timezone: "UTC",
      window: { days: 30, from: "2026-02-09T00:00:00.000Z", to: "2026-03-10T09:00:00.000Z" },
    });
    expect(body.providers).toHaveLength(PROVIDERS.length);
    const days = body.providers.find((provider) => provider.id === "rfi")!.days;
    expect(days).toHaveLength(30);
    expect(days[0]).toMatchObject({
      date: "2026-02-09",
      requests: 0,
      successRate: null,
      partial: false,
      status: "unknown",
      latency: { p50: null, p99: null, p999: null },
    });
    expect(days[28]).toMatchObject({
      date: "2026-03-09",
      requests: 70,
      timeouts: 10,
      samples: 7,
      status: "degraded",
      latencySamples: 6,
      latencyRequests: 60,
      latency: { p50: 100, p99: 250, p999: 400 },
    });
    expect(days[29]).toMatchObject({ date: "2026-03-10", partial: true });
    expect(
      body.providers
        .find((provider) => provider.id === "entur")!
        .days.every((day) => day.latency.p50 === null),
    ).toBe(true);
    const sql = analyticsQueries(fetchMock).find((query) =>
      query.includes("quantileExactWeighted"),
    )!;
    expect(sql).toContain("quantileExactWeighted(0.5)(double1, _sample_interval)");
    expect(sql).toContain("quantileExactWeighted(0.99)(double1, _sample_interval)");
    expect(sql).toContain("quantileExactWeighted(0.999)(double1, _sample_interval)");
    expect(sql).toContain("AND double1 >= 0");
    expect(sql).toContain("blob2 = 'live'");
    expect(sql).toContain("'Etc/UTC'");
    const healthSql = analyticsQueries(fetchMock).find(
      (query) => !query.includes("quantileExactWeighted"),
    )!;
    expect(healthSql).not.toContain("double1 >= 0");
  });

  it("keeps failures with no timing in daily health and excludes invalid percentiles", async () => {
    mockAnalytics(fetchMock, [
      [
        "quantileExactWeighted",
        [
          {
            provider: "db",
            date: "2026-03-10",
            p50: -1,
            p99: null,
            p999: "nan",
            latencySamples: 1,
            latencyRequests: 1,
          },
        ],
      ],
      [
        "FROM provider_metrics",
        [
          {
            ...counts("rfi", { requests: 5, successes: 0, errors: 5, samples: 5 }),
            date: "2026-03-10",
          },
        ],
      ],
    ]);
    const { response } = await request("/status/latency");
    const body = (await response.json()) as StatusLatency;
    expect(body.providers.find((provider) => provider.id === "rfi")!.days[29]).toMatchObject({
      requests: 5,
      status: "outage",
      latency: { p50: null, p99: null, p999: null },
    });
    expect(body.providers.find((provider) => provider.id === "db")!.days[29]!.latency).toEqual({
      p50: null,
      p99: null,
      p999: null,
    });
  });

  it("keeps 30 days across a year boundary at UTC midnight", async () => {
    freezeTime("2026-01-01T00:00:00.000Z");
    mockAnalytics(fetchMock, [["FROM provider_metrics", []]]);
    const { response } = await request("/status/latency");
    const body = (await response.json()) as StatusLatency;
    expect(body.providers[0]!.days).toHaveLength(30);
    expect(body.providers[0]!.days[0]!.date).toBe("2025-12-03");
    expect(body.providers[0]!.days[29]).toMatchObject({
      date: "2026-01-01",
      partial: true,
      requests: 0,
    });
  });
});

describe.each(["summary", "latency"])("status/%s resilience", (endpoint) => {
  it("returns a non-cacheable 503 on upstream failure without exposing credentials", async () => {
    const logs = captureLogs();
    fetchMock.fail();
    const { response } = await request(`/status/${endpoint}`);
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.text();
    expect(body).toContain("temporarily unavailable");
    expect(body).not.toContain("test-token");
    expect(logs.errors()).toHaveLength(1);
  });

  it("applies the existing API rate limiter", async () => {
    const { response } = await request(
      `/status/${endpoint}`,
      {},
      createEnv({ RATE_LIMITER: createRateLimiter(false) }),
    );
    expect(response.status).toBe(429);
    expect(fetchMock.fetch).not.toHaveBeenCalled();
  });
});
