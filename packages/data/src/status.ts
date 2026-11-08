import type { Provider } from "./providers";

/**
 * Each provider's current health uses the shortest of these windows with enough observations:
 * busy providers reflect the last hour, while quieter ones fall back to 3 or 24 hours.
 */
export const STATUS_SUMMARY_WINDOWS_MINUTES = [60, 3 * 60, 24 * 60] as const;
/** The outer summary window, which also bounds each provider's last observation. */
export const STATUS_SUMMARY_WINDOW_MINUTES = STATUS_SUMMARY_WINDOWS_MINUTES.at(-1)!;

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
  providers: (Provider &
    ProviderObservations & {
      /** The window these observations cover: the shortest with enough samples. */
      windowMinutes: number;
      lastSeen: string | null;
    })[];
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
