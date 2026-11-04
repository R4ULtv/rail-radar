import { describe, expect, it } from "vitest";

import {
  ScraperError,
  dedupeSortLimit,
  formatTime,
  resolveBrand,
  statusFromWindow,
  stripCountryPrefix,
} from "../../src/scrapers/core";

describe("formatTime", () => {
  it("formats an ISO instant as HH:MM in the given zone", () => {
    expect(formatTime("2026-07-01T12:05:00Z", "Europe/Rome")).toBe("14:05");
    expect(formatTime("2026-01-15T12:05:00Z", "Europe/London")).toBe("12:05");
    expect(formatTime("2026-01-15T23:30:00Z", "Europe/Helsinki")).toBe("01:30");
  });

  it("returns a placeholder for a missing time", () => {
    expect(formatTime(null, "Europe/Rome")).toBe("--:--");
    expect(formatTime("", "Europe/Rome")).toBe("--:--");
  });
});

describe("stripCountryPrefix", () => {
  it("removes the leading uppercase country prefix", () => {
    expect(stripCountryPrefix("CH8503000")).toBe("8503000");
    expect(stripCountryPrefix("IT1728")).toBe("1728");
    expect(stripCountryPrefix("123")).toBe("123");
  });
});

describe("statusFromWindow", () => {
  const now = Date.parse("2026-03-10T09:00:00Z");
  const window = 5 * 60_000;

  it("flags trains inside the window by board type", () => {
    expect(statusFromWindow(now + 60_000, now, window, "departures")).toBe("departing");
    expect(statusFromWindow(now - 60_000, now, window, "arrivals")).toBe("incoming");
  });

  it("includes both window edges", () => {
    expect(statusFromWindow(now + window, now, window, "departures")).toBe("departing");
    expect(statusFromWindow(now - window, now, window, "departures")).toBe("departing");
  });

  it("returns null outside the window", () => {
    expect(statusFromWindow(now + window + 1, now, window, "departures")).toBeNull();
    expect(statusFromWindow(now - window - 1, now, window, "arrivals")).toBeNull();
  });
});

describe("dedupeSortLimit", () => {
  const items = [
    { id: "b", t: 2 },
    { id: "a", t: 1 },
    { id: "b", t: 3 },
    { id: "c", t: 4 },
  ];

  it("sorts, keeps the first item per key and stops at the limit", () => {
    expect(
      dedupeSortLimit(
        items,
        (item) => item.id,
        (x, y) => x.t - y.t,
        2,
      ),
    ).toEqual([
      { id: "a", t: 1 },
      { id: "b", t: 2 },
    ]);
  });

  it("does not mutate the input", () => {
    const copy = items.slice();
    dedupeSortLimit(
      items,
      (item) => item.id,
      (x, y) => y.t - x.t,
      10,
    );
    expect(items).toEqual(copy);
  });
});

describe("resolveBrand", () => {
  it("maps known international codes case-insensitively", () => {
    expect(resolveBrand("EUR", null)).toBe("Eurostar");
    expect(resolveBrand(" ice ", null)).toBe("DB");
    expect(resolveBrand("tgv", null)).toBe("SNCF");
    expect(resolveBrand("THA", null)).toBe("Thalys");
  });

  it("falls back for unknown or empty codes", () => {
    expect(resolveBrand("IC", "SNCB")).toBe("SNCB");
    expect(resolveBrand("", "SNCB")).toBe("SNCB");
    expect(resolveBrand(undefined, null)).toBeNull();
  });
});

describe("ScraperError", () => {
  it("carries status, timing, upstream and cause", () => {
    const cause = new Error("boom");
    const error = new ScraperError(
      "Upstream failed",
      502,
      { fetchMs: 12 },
      {
        cause,
        upstream: { host: "example.test", path: "/board", status: 502 },
      },
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ScraperError");
    expect(error.statusCode).toBe(502);
    expect(error.timing).toEqual({ fetchMs: 12 });
    expect(error.upstream).toEqual({ host: "example.test", path: "/board", status: 502 });
    expect(error.cause).toBe(cause);
  });
});
