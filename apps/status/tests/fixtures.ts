import { PROVIDERS } from "@repo/data/providers";
import type { StatusLatency, StatusSummary } from "@repo/data/status";

const policy = { minSamples: 5, degradedFailureRate: 0.05, outageFailureRate: 0.5 };

export function summaryFixture(): StatusSummary {
  const now = new Date();
  return {
    generatedAt: now.toISOString(),
    source: "live",
    scope: "provider-fetches",
    window: {
      from: new Date(now.getTime() - 86_400_000).toISOString(),
      to: now.toISOString(),
      minutes: 1440,
    },
    policy,
    overall: "degraded",
    counts: { operational: 13, degraded: 1, unknown: 1, outage: 0 },
    providers: PROVIDERS.map((provider) => ({
      ...provider,
      requests: 10,
      successes: provider.id === "sncf" ? 9 : 10,
      errors: provider.id === "sncf" ? 1 : 0,
      timeouts: 0,
      samples: provider.id === "digitraffic" ? 2 : 10,
      syntheticRequests: provider.id === "digitraffic" ? 2 : 1,
      syntheticSuccesses: provider.id === "digitraffic" ? 2 : 1,
      successRate: provider.id === "sncf" ? 0.9 : 1,
      status:
        provider.id === "sncf"
          ? "degraded"
          : provider.id === "digitraffic"
            ? "unknown"
            : "operational",
      windowMinutes: provider.id === "digitraffic" ? 1440 : 60,
      lastSeen: now.toISOString(),
    })),
  };
}

export function latencyFixture(): StatusLatency {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const from = today - 29 * 86_400_000;
  return {
    generatedAt: now.toISOString(),
    source: "live",
    timezone: "UTC",
    unit: "ms",
    window: { from: new Date(from).toISOString(), to: now.toISOString(), days: 30 },
    policy,
    providers: PROVIDERS.map((provider) => ({
      ...provider,
      days: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(from + i * 86_400_000).toISOString().slice(0, 10),
        partial: i === 29,
        requests: provider.id === "rfi" ? 10 : 0,
        successes: provider.id === "rfi" ? 10 : 0,
        errors: 0,
        timeouts: 0,
        samples: provider.id === "rfi" ? 10 : 0,
        // RFI's day 27 has only scheduled checks; its other days are mostly visitors.
        syntheticRequests: provider.id === "rfi" ? (i === 27 ? 10 : 2) : 0,
        syntheticSuccesses: provider.id === "rfi" ? (i === 27 ? 10 : 2) : 0,
        successRate: provider.id === "rfi" ? 1 : null,
        status: provider.id === "rfi" ? "operational" : "unknown",
        latency:
          provider.id === "rfi" && i === 28
            ? { p50: 120, p99: 800, p999: 1400 }
            : { p50: null, p99: null, p999: null },
        latencySamples: provider.id === "rfi" && i === 28 ? 10 : 0,
        latencyRequests: provider.id === "rfi" && i === 28 ? 10 : 0,
      })),
    })),
  };
}
