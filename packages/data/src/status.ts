import type { Provider } from "./providers";

/** Passive traffic needs a full day's observations to cover quieter providers. */
export const STATUS_SUMMARY_WINDOW_MINUTES = 24 * 60;

export type ProviderHealth = "operational" | "degraded" | "outage" | "unknown";

export interface ProviderObservations {
  /** Estimated request counts, weighted by Analytics Engine's sample interval. */
  requests: number;
  successes: number;
  errors: number;
  timeouts: number;
  /** Actual stored observations, before weighting. Used for the minimum-data policy. */
  samples: number;
  successRate: number | null;
  status: ProviderHealth;
}

export interface StatusPolicy {
  minSamples: number;
  degradedFailureRate: number;
  outageFailureRate: number;
}

export interface StatusSummary {
  generatedAt: string;
  source: "live";
  scope: "provider-fetches";
  window: { from: string; to: string; minutes: number };
  policy: StatusPolicy;
  overall: ProviderHealth;
  counts: Record<ProviderHealth, number>;
  providers: (Provider & ProviderObservations & { lastSeen: string | null })[];
}

export interface LatencyDay {
  date: string;
  partial: boolean;
  latency: { p50: number | null; p99: number | null; p999: number | null };
  latencySamples: number;
  latencyRequests: number;
}

export interface ProviderDay extends ProviderObservations, LatencyDay {}

export interface StatusLatency {
  generatedAt: string;
  source: "live";
  timezone: "UTC";
  unit: "ms";
  window: { from: string; to: string; days: number };
  policy: StatusPolicy;
  providers: (Provider & { days: ProviderDay[] })[];
}
