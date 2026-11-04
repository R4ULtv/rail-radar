import { env as workerEnv } from "cloudflare:workers";
import { vi } from "vitest";

import type { Bindings } from "../../src/lib/env";

export type RateLimiterMock = { limit: ReturnType<typeof vi.fn> };
export type AnalyticsMock = { writeDataPoint: ReturnType<typeof vi.fn> };

export function createRateLimiter(success = true): RateLimiterMock {
  return { limit: vi.fn(async () => ({ success })) };
}

export function createAnalyticsDataset(): AnalyticsMock {
  return { writeDataPoint: vi.fn() };
}

/** An ASSETS binding serving `files` by pathname (e.g. "/it-milano-m1.json"), 404 otherwise. */
export function createAssets(files: Record<string, unknown> = {}) {
  return {
    fetch: vi.fn(async (input: RequestInfo | URL) => {
      const { pathname } = new URL(input instanceof Request ? input.url : input);
      if (!(pathname in files)) return new Response("Not found", { status: 404 });
      return new Response(JSON.stringify(files[pathname]), {
        headers: { "Content-Type": "application/json" },
      });
    }),
  };
}

/** Every binding the Worker reads, with permissive rate limiters and fake secrets. */
export function createEnv(overrides: Partial<Record<keyof Bindings, unknown>> = {}) {
  const env = {
    ASSETS: createAssets(),
    RATE_LIMITER: createRateLimiter(),
    STATION_RATE_LIMITER: createRateLimiter(),
    MAP_GENERATION_RATE_LIMITER: createRateLimiter(),
    STATION_ANALYTICS: createAnalyticsDataset(),
    PROVIDER_ANALYTICS: createAnalyticsDataset(),
    CLOUDFLARE_ACCOUNT_ID: "test-account",
    CLOUDFLARE_API_TOKEN: "test-token",
    IP_HASH_PEPPER: "test-pepper",
    DB_CLIENT_ID: "test-db-client",
    DB_API_KEY: "test-db-key",
    NS_API_KEY: "test-ns-key",
    LDBWS_API_KEY: "test-ldbws-key",
    TRAFIKLAB_KEY: "test-trafiklab-key",
    REJSEPLANEN_API_KEY: "test-rejseplanen-key",
    PLK_API_KEY: "test-plk-key",
    SNCF_API_KEY: "test-sncf-key",
    MOBILITEIT_API_KEY: "test-mobiliteit-key",
    MAPBOX_TOKEN: "test-mapbox-token",
    ...overrides,
  };
  return env as typeof env & Bindings;
}

/** An ExecutionContext that collects `waitUntil` promises so tests can await them. */
export function createExecutionCtx() {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: vi.fn((promise: Promise<unknown>) => {
      pending.push(promise);
    }),
    passThroughOnException: vi.fn(),
    props: {},
    /** Settle every background task registered so far. */
    flush: () => Promise.allSettled(pending),
  };
  return ctx as typeof ctx & ExecutionContext;
}

/** The real ASSETS binding from wrangler.jsonc, serving packages/data/src/lines. */
export function createLineAssets() {
  const assets = (workerEnv as unknown as Bindings).ASSETS;
  return { fetch: vi.fn((input: RequestInfo | URL) => assets.fetch(input)) };
}
