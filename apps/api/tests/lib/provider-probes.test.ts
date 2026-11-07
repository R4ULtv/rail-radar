import { PROVIDERS } from "@repo/data/providers";
import { stationById } from "@repo/data/stations";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProviderByStationId } from "../../src/analytics";
import type { Bindings } from "../../src/lib/env";
import worker from "../../src/index";
import { PROBE_STATIONS, probeProvider, runProviderProbes } from "../../src/provider-probes";
import {
  captureLogs,
  createEnv,
  createExecutionCtx,
  jsonResponse,
  mockFetch,
  type AnalyticsMock,
  type FetchMock,
} from "../helpers";

let fetchMock: FetchMock;
beforeEach(() => {
  fetchMock = mockFetch();
});
afterEach(() => vi.restoreAllMocks());

/** The mock bindings cover everything probes read; cast once rather than at each call. */
const bindings = (env: ReturnType<typeof createEnv>) => env as unknown as Bindings;

const written = (env: ReturnType<typeof createEnv>) =>
  (env.PROVIDER_ANALYTICS as AnalyticsMock).writeDataPoint.mock.calls.map(([point]) => point);

describe("probe stations", () => {
  it.each(PROVIDERS.map((provider) => [provider.id]))(
    "%s probes a top-importance rail hub that its own scraper serves",
    (provider) => {
      const station = stationById.get(PROBE_STATIONS[provider]);
      expect(station).toMatchObject({ type: "rail", importance: 1 });
      expect(getProviderByStationId(station!.id)).toBe(provider);
    },
  );
});

describe("probeProvider", () => {
  it("records a successful hub board as a synthetic departures observation", async () => {
    fetchMock.on("rata.digitraffic.fi", jsonResponse([]));
    const env = createEnv();
    expect(await probeProvider(bindings(env), "digitraffic")).toBe("success");
    expect(written(env)).toEqual([
      {
        blobs: ["digitraffic", "synthetic", "success", "departures", "FI001", "fi"],
        doubles: [expect.any(Number), 200],
        indexes: ["digitraffic"],
      },
    ]);
  });

  it("records an upstream timeout as a timeout, like live requests", async () => {
    const logs = captureLogs();
    fetchMock.on("rata.digitraffic.fi", jsonResponse({}, { status: 504 }));
    const env = createEnv();
    expect(await probeProvider(bindings(env), "digitraffic")).toBe("timeout");
    expect(written(env)[0]).toMatchObject({
      blobs: ["digitraffic", "synthetic", "timeout", "departures", "FI001", "fi"],
      doubles: [expect.any(Number), 504],
    });
    expect(logs.warnings()[0]).toMatchObject({
      message: "Provider probe failed",
      result: "timeout",
    });
  });

  it("records an unparseable board as an error with no timing", async () => {
    captureLogs();
    fetchMock.on("rata.digitraffic.fi", jsonResponse({ unexpected: true }));
    const env = createEnv();
    expect(await probeProvider(bindings(env), "digitraffic")).toBe("error");
    expect(written(env)[0]).toMatchObject({
      blobs: ["digitraffic", "synthetic", "error", "departures", "FI001", "fi"],
      doubles: [-1, 500],
    });
  });
});

describe("scheduled probes", () => {
  it("requests every provider once and records one observation each, even when all fail", async () => {
    captureLogs();
    vi.spyOn(console, "log").mockImplementation(() => {});
    // No upstream is mocked, so every scraper fails; each must still be recorded.
    const env = createEnv();
    const results = await runProviderProbes(bindings(env));
    expect(Object.keys(results)).toEqual(PROVIDERS.map((provider) => provider.id));
    expect(Object.values(results).every((result) => result === "error")).toBe(true);
    const points = written(env);
    expect(points).toHaveLength(PROVIDERS.length);
    expect(points.map((point) => point.blobs[1])).toEqual(PROVIDERS.map(() => "synthetic"));
    expect(new Set(points.map((point) => point.blobs[0])).size).toBe(PROVIDERS.length);
  });

  it("runs the probes from the Worker's scheduled handler", async () => {
    captureLogs();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const env = createEnv();
    const ctx = createExecutionCtx();
    worker.scheduled(
      { cron: "0 * * * *", scheduledTime: Date.now(), noRetry() {} } as ScheduledController,
      bindings(env),
      ctx,
    );
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    await ctx.flush();
    expect(written(env)).toHaveLength(PROVIDERS.length);
  });
});
