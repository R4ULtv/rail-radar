import type { LatencyDay, ProviderHealth, StatusSummary } from "@repo/data/status";

export const SUMMARY_MAX_AGE_MS = 120_000;

export function isCurrent(timestamp: string | undefined, now: number) {
  if (!timestamp) return false;
  const age = now - Date.parse(timestamp);
  return Number.isFinite(age) && age >= -60_000 && age <= SUMMARY_MAX_AGE_MS;
}

export function latestTimedDay<Day extends LatencyDay>(days: Day[] | undefined) {
  return days?.findLast((day) => day.latency.p50 !== null);
}

export function healthCounts(
  summary: StatusSummary | undefined,
  verified: boolean,
  total: number,
): Record<ProviderHealth, number> {
  return summary && verified
    ? summary.counts
    : { operational: 0, degraded: 0, outage: 0, unknown: total };
}

export const needsAttention = (status: ProviderHealth) => status !== "operational";
