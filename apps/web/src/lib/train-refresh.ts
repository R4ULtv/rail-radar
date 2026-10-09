const REFRESH_INTERVAL_MS = 30_000;
const MIN_REFETCH_INTERVAL_MS = 5_000;

export function getTrainRefetchInterval(
  {
    timestamp,
    hasError = false,
    retryAfterMs = 0,
  }: { timestamp?: string; hasError?: boolean; retryAfterMs?: number },
  now = Date.now(),
): number {
  if (hasError) return Math.max(REFRESH_INTERVAL_MS, retryAfterMs);

  const snapshotTime = Date.parse(timestamp ?? "");
  if (!Number.isFinite(snapshotTime)) return REFRESH_INTERVAL_MS;

  const age = Math.max(0, now - snapshotTime);
  // An expired snapshot may be returned again. Keep a normal cadence instead of
  // repeatedly requesting it at the minimum interval until its timestamp changes.
  if (age >= REFRESH_INTERVAL_MS) return REFRESH_INTERVAL_MS;

  return Math.max(MIN_REFETCH_INTERVAL_MS, REFRESH_INTERVAL_MS - age);
}
