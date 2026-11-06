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
  /** Null if API analytics could not be read; an empty dataset instead has unknown health. */
  api: ApiSummary | null;
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

export interface ApiObservations {
  requests: number;
  successes: number;
  clientErrors: number;
  /** A subset of clientErrors, rather than an additional outcome. */
  rateLimited: number;
  serverErrors: number;
  samples: number;
  /** Actual observations excluding 4xx, used for the minimum-data policy. */
  healthSamples: number;
  /** 2xx/3xx divided by 2xx/3xx/5xx; client errors are reported separately. */
  successRate: number | null;
  status: ProviderHealth;
}

export interface ApiSummary extends ApiObservations {
  id: "rail-radar-api";
  name: "Rail Radar API";
  scope: "api-requests";
  lastSeen: string | null;
}

export interface ApiDay extends ApiObservations, LatencyDay {}

export interface ApiLatency {
  id: "rail-radar-api";
  name: "Rail Radar API";
  scope: "api-requests";
  days: ApiDay[];
}

export interface StatusLatency {
  generatedAt: string;
  source: "live";
  timezone: "UTC";
  unit: "ms";
  window: { from: string; to: string; days: number };
  policy: StatusPolicy;
  api: ApiLatency | null;
  providers: (Provider & { days: ProviderDay[] })[];
}
