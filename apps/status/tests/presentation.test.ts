import { describe, expect, it } from "vitest";
import { isNewRailData, NEW_RAIL_DATA, NEW_RAIL_DATA_DAYS } from "@repo/data/countries";
import type { CountryCode } from "@repo/data/countries";
import { logAxis } from "../src/latency-chart";
import { healthCounts, isCurrent, latestTimedDay, SUMMARY_MAX_AGE_MS } from "../src/presentation";
import { latencyFixture, summaryFixture } from "./fixtures";

describe("observation freshness", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");
  it("expires old health even if stale query data is still cached", () => {
    expect(isCurrent(new Date(now - SUMMARY_MAX_AGE_MS).toISOString(), now)).toBe(true);
    expect(isCurrent(new Date(now - SUMMARY_MAX_AGE_MS - 1).toISOString(), now)).toBe(false);
    expect(healthCounts(summaryFixture(), false, 15)).toEqual({
      operational: 0,
      degraded: 0,
      outage: 0,
      unknown: 15,
    });
  });
  it("rejects missing, invalid, and implausibly future timestamps", () => {
    expect(isCurrent(undefined, now)).toBe(false);
    expect(isCurrent("invalid", now)).toBe(false);
    expect(isCurrent(new Date(now + 120_000).toISOString(), now)).toBe(false);
  });
});

describe("latest latency observation", () => {
  it("uses the latest timed day when today has no timing and keeps missing data empty", () => {
    const data = latencyFixture();
    const rfi = data.providers.find((provider) => provider.id === "rfi")!;
    expect(latestTimedDay(rfi.days)).toBe(rfi.days[28]);
    const untimed = data.providers.find((provider) => provider.id === "digitraffic")!;
    expect(latestTimedDay(untimed.days)).toBeUndefined();
    expect(latestTimedDay(undefined)).toBeUndefined();
  });
});

describe("new rail data flag", () => {
  const [listed] = Object.entries(NEW_RAIL_DATA) as [CountryCode, string][];

  it("never flags a country that is not listed", () => {
    expect(isNewRailData("it", 0)).toBe(false);
    expect(isNewRailData("it", Date.now())).toBe(false);
  });

  it.skipIf(!listed)("flags a listed country before hydration and until it lapses", () => {
    const [country, since] = listed!;
    const start = Date.parse(`${since}T00:00:00Z`);
    const lapses = start + NEW_RAIL_DATA_DAYS * 86_400_000;
    expect(isNewRailData(country, 0)).toBe(true);
    expect(isNewRailData(country, start)).toBe(true);
    expect(isNewRailData(country, lapses - 1)).toBe(true);
    expect(isNewRailData(country, lapses)).toBe(false);
  });
});

describe("latency log axis", () => {
  it("fits the nearest 1-3-10 steps around typical latencies and timeouts", () => {
    expect(logAxis([42, 355, 12_000])).toEqual({
      domain: [30, 30_000],
      ticks: [30, 100, 300, 1_000, 3_000, 10_000, 30_000],
    });
    expect(logAxis([120, 896, 2_500])).toEqual({
      domain: [100, 3_000],
      ticks: [100, 300, 1_000, 3_000],
    });
  });

  it("widens a single value to the next step and places zero timings at 1 ms", () => {
    expect(logAxis([100]).domain).toEqual([100, 300]);
    expect(logAxis([0, 250]).domain).toEqual([1, 300]);
  });
});
