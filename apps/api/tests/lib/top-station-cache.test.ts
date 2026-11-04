import { describe, expect, it, vi } from "vitest";

import {
  getCachedTopStationAggregate,
  TOP_STATION_CACHE_TTL_SECONDS,
  type CachedTopStation,
} from "../../src/lib/top-station-cache";

const TOP: CachedTopStation = {
  stationId: "IT1728",
  stationName: "Milano Centrale",
  country: "it",
  visits: 120,
  uniqueVisitors: 80,
};

function createCache(entry?: unknown) {
  return {
    match: vi.fn(async () => (entry === undefined ? undefined : Response.json(entry))),
    put: vi.fn(async () => {}),
  };
}

describe("getCachedTopStationAggregate", () => {
  it("returns a valid cached entry without loading", async () => {
    const cache = createCache(TOP);
    const load = vi.fn();

    await expect(getCachedTopStationAggregate(cache, "acct", "day", load)).resolves.toEqual(TOP);
    expect(load).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("treats a cached null (no visits yet) as a hit", async () => {
    const cache = createCache(null);
    const load = vi.fn();

    await expect(getCachedTopStationAggregate(cache, "acct", "day", load)).resolves.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("keys the cache by account and period", async () => {
    const cache = createCache(TOP);

    await getCachedTopStationAggregate(cache, "a/b c", "week", vi.fn());

    expect(cache.match).toHaveBeenCalledWith(
      "https://api.railradar24.com/__internal/cache/top-station/v1/a%2Fb%20c/week/global/unique-visitors/limit-1",
    );
  });

  it("loads and stores the value on a miss", async () => {
    const cache = createCache();
    const load = vi.fn(async () => TOP);

    await expect(getCachedTopStationAggregate(cache, "acct", "day", load)).resolves.toEqual(TOP);

    expect(load).toHaveBeenCalledOnce();
    const [, stored] = cache.put.mock.calls[0] as unknown as [string, Response];
    expect(stored.headers.get("Cache-Control")).toBe(
      `public, max-age=${TOP_STATION_CACHE_TTL_SECONDS}`,
    );
    expect(await stored.json()).toEqual(TOP);
  });

  it.each([
    ["a malformed entry", { stationId: 1 }],
    ["an unknown country", { ...TOP, country: "xx" }],
    ["a non-finite count", { ...TOP, visits: "12" }],
    ["a non-object", "IT1728"],
  ])("reloads when the cache holds %s", async (_label, entry) => {
    const cache = createCache(entry);
    const load = vi.fn(async () => TOP);

    await expect(getCachedTopStationAggregate(cache, "acct", "day", load)).resolves.toEqual(TOP);
    expect(load).toHaveBeenCalledOnce();
  });

  it("survives cache read and write failures", async () => {
    const cache = {
      match: vi.fn(async () => {
        throw new Error("cache down");
      }),
      put: vi.fn(async () => {
        throw new Error("cache down");
      }),
    };

    await expect(
      getCachedTopStationAggregate(cache, "acct", "day", async () => TOP),
    ).resolves.toEqual(TOP);
  });

  it("propagates load failures", async () => {
    const cache = createCache();
    await expect(
      getCachedTopStationAggregate(cache, "acct", "day", async () => {
        throw new Error("analytics down");
      }),
    ).rejects.toThrow("analytics down");
  });
});
