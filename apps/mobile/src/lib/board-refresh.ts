const refreshIntervalMs = 30_000;
const minRefetchIntervalMs = 1_000;

/** Use HTTP server time, rather than the phone's potentially skewed wall clock. */
export function boardRefreshDelay(timestamp: string, headers: Headers): number {
  const snapshotTime = Date.parse(timestamp);
  const serverTime = Date.parse(headers.get("Date") ?? "");
  if (!Number.isFinite(snapshotTime) || !Number.isFinite(serverTime)) return refreshIntervalMs;

  // A cached response may retain its original Date, with Age recording time in the cache.
  const cachedAge = Number(headers.get("Age") ?? 0);
  const age = Math.max(
    0,
    serverTime -
      snapshotTime +
      (Number.isFinite(cachedAge) && cachedAge >= 0 ? cachedAge * 1_000 : 0),
  );
  return Math.max(minRefetchIntervalMs, refreshIntervalMs - age);
}
