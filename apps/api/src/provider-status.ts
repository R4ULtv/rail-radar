import { PROVIDERS } from "@repo/data/providers";
import type {
  ProviderDay,
  ProviderHealth,
  ProviderObservations,
  StatusLatency,
  StatusPolicy,
  StatusSummary,
} from "@repo/data/status";
import { queryAnalytics } from "./analytics";
import { STATUS_SUMMARY_WINDOW_MINUTES, STATUS_SUMMARY_WINDOWS_MINUTES } from "@repo/data/status";

const DAY_MS = 86_400_000;
const DAYS = 30;
export const STATUS_POLICY: StatusPolicy = {
  minSamples: 5,
  degradedFailureRate: 0.05,
  outageFailureRate: 0.5,
};

// Analytics Engine serializes some numeric aggregates as strings.
type Numeric = number | string;
interface CountsRow {
  provider: string;
  requests: Numeric;
  successes: Numeric;
  errors: Numeric;
  timeouts: Numeric;
  samples: Numeric;
  syntheticRequests: Numeric;
  syntheticSuccesses: Numeric;
}
// One row per provider, with counts suffixed by window length, e.g. `requests60`.
type SummaryRow = { provider: string; lastSeen: Numeric } & Record<string, Numeric>;
interface DayRow extends CountsRow {
  date: string;
}
interface LatencyRow {
  provider: string;
  date: string;
  p50: Numeric | null;
  p99: Numeric | null;
  p999: Numeric | null;
  latencySamples: Numeric;
  latencyRequests: Numeric;
}
interface QueryResult<Row> {
  data: Row[];
}

const COUNTS_SQL = `
  sum(_sample_interval) AS requests,
  sumIf(_sample_interval, blob3 = 'success') AS successes,
  sumIf(_sample_interval, blob3 = 'error') AS errors,
  sumIf(_sample_interval, blob3 = 'timeout') AS timeouts,
  count() AS samples,
  sumIf(_sample_interval, blob2 = 'synthetic') AS syntheticRequests,
  sumIf(_sample_interval, blob2 = 'synthetic' AND blob3 = 'success') AS syntheticSuccesses`;

export function observations(row?: CountsRow): ProviderObservations {
  const requests = Number(row?.requests ?? 0);
  const successes = Number(row?.successes ?? 0);
  const errors = Number(row?.errors ?? 0);
  const timeouts = Number(row?.timeouts ?? 0);
  const samples = Number(row?.samples ?? 0);
  const syntheticRequests = Number(row?.syntheticRequests ?? 0);
  const syntheticSuccesses = Number(row?.syntheticSuccesses ?? 0);
  const successRate = requests > 0 ? successes / requests : null;
  const failureRate = requests > 0 ? (errors + timeouts) / requests : 0;
  const status: ProviderHealth =
    requests === 0 || samples < STATUS_POLICY.minSamples
      ? "unknown"
      : failureRate >= STATUS_POLICY.outageFailureRate
        ? "outage"
        : failureRate >= STATUS_POLICY.degradedFailureRate
          ? "degraded"
          : "operational";
  return {
    requests,
    successes,
    errors,
    timeouts,
    samples,
    syntheticRequests,
    syntheticSuccesses,
    successRate,
    status,
  };
}

function windowCountsSql(minutes: number, since: number) {
  const inWindow = `timestamp >= toDateTime(${Math.floor(since / 1000)})`;
  return `sumIf(_sample_interval, ${inWindow}) AS requests${minutes},
    sumIf(_sample_interval, blob3 = 'success' AND ${inWindow}) AS successes${minutes},
    sumIf(_sample_interval, blob3 = 'error' AND ${inWindow}) AS errors${minutes},
    sumIf(_sample_interval, blob3 = 'timeout' AND ${inWindow}) AS timeouts${minutes},
    countIf(${inWindow}) AS samples${minutes},
    sumIf(_sample_interval, blob2 = 'synthetic' AND ${inWindow}) AS syntheticRequests${minutes},
    sumIf(_sample_interval, blob2 = 'synthetic' AND blob3 = 'success' AND ${inWindow}) AS syntheticSuccesses${minutes}`;
}

/** The shortest window with enough observations, or the longest window if none has. */
function adaptiveObservations(row: SummaryRow | undefined) {
  const windows = STATUS_SUMMARY_WINDOWS_MINUTES.map((minutes) => ({
    windowMinutes: minutes as number,
    ...observations(
      row && {
        provider: row.provider,
        requests: row[`requests${minutes}`] ?? 0,
        successes: row[`successes${minutes}`] ?? 0,
        errors: row[`errors${minutes}`] ?? 0,
        timeouts: row[`timeouts${minutes}`] ?? 0,
        samples: row[`samples${minutes}`] ?? 0,
        syntheticRequests: row[`syntheticRequests${minutes}`] ?? 0,
        syntheticSuccesses: row[`syntheticSuccesses${minutes}`] ?? 0,
      },
    ),
  }));
  return windows.find((window) => window.status !== "unknown") ?? windows.at(-1)!;
}

// All query bounds originate from the clock, never from request parameters. Scheduled probes
// ("synthetic") count alongside visitor traffic ("live"); both exercise the same scrapers.
function bounds(from: number, to: number) {
  return `timestamp >= toDateTime(${Math.floor(from / 1000)})
    AND timestamp < toDateTime(${Math.floor(to / 1000)})
    AND blob2 IN ('live', 'synthetic')
    AND blob3 IN ('success', 'error', 'timeout')`;
}

export async function getProviderSummary(
  accountId: string,
  apiToken: string,
  now = new Date(),
): Promise<StatusSummary> {
  const to = Math.floor(now.getTime() / 1000) * 1000;
  const from = to - STATUS_SUMMARY_WINDOW_MINUTES * 60_000;
  const result = await queryAnalytics<QueryResult<SummaryRow>>(
    accountId,
    apiToken,
    `SELECT index1 AS provider,
      ${STATUS_SUMMARY_WINDOWS_MINUTES.map((minutes) => windowCountsSql(minutes, to - minutes * 60_000)).join(",\n")},
      max(toUnixTimestamp(timestamp)) AS lastSeen
    FROM provider_metrics
    WHERE ${bounds(from, to)}
    GROUP BY provider`,
    "provider status summary",
    AbortSignal.timeout(10_000),
  );
  const byProvider = new Map(result.data.map((row) => [row.provider, row]));
  const providers = PROVIDERS.map((provider) => {
    const row = byProvider.get(provider.id);
    return {
      ...provider,
      ...adaptiveObservations(row),
      lastSeen: row ? new Date(Number(row.lastSeen) * 1000).toISOString() : null,
    };
  });
  const counts: StatusSummary["counts"] = { operational: 0, degraded: 0, outage: 0, unknown: 0 };
  for (const provider of providers) counts[provider.status]++;
  const overall: ProviderHealth =
    counts.outage === providers.length
      ? "outage"
      : counts.degraded + counts.outage > 0
        ? "degraded"
        : counts.unknown > 0
          ? "unknown"
          : "operational";
  return {
    generatedAt: now.toISOString(),
    source: "live",
    scope: "provider-fetches",
    window: {
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      minutes: STATUS_SUMMARY_WINDOW_MINUTES,
    },
    policy: STATUS_POLICY,
    overall,
    counts,
    providers,
  };
}

export async function getProviderLatency(
  accountId: string,
  apiToken: string,
  now = new Date(),
): Promise<StatusLatency> {
  const to = Math.floor(now.getTime() / 1000) * 1000;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const from = today - (DAYS - 1) * DAY_MS;
  const grouping = "index1 AS provider, formatDateTime(timestamp, '%Y-%m-%d', 'Etc/UTC') AS date";
  // Separate queries preserve failures without timings in health counts while excluding
  // the writer's -1 sentinel from latency. Never average per-group percentiles.
  const [health, latency] = await Promise.all([
    queryAnalytics<QueryResult<DayRow>>(
      accountId,
      apiToken,
      `SELECT ${grouping}, ${COUNTS_SQL}
      FROM provider_metrics WHERE ${bounds(from, to)}
      GROUP BY provider, date ORDER BY provider, date`,
      "provider daily health",
      AbortSignal.timeout(10_000),
    ),
    queryAnalytics<QueryResult<LatencyRow>>(
      accountId,
      apiToken,
      `SELECT ${grouping},
        quantileExactWeighted(0.5)(double1, _sample_interval) AS p50,
        quantileExactWeighted(0.99)(double1, _sample_interval) AS p99,
        quantileExactWeighted(0.999)(double1, _sample_interval) AS p999,
        count() AS latencySamples, sum(_sample_interval) AS latencyRequests
      FROM provider_metrics WHERE ${bounds(from, to)} AND double1 >= 0
      GROUP BY provider, date ORDER BY provider, date`,
      "provider daily latency",
      AbortSignal.timeout(10_000),
    ),
  ]);
  const healthByDay = new Map(health.data.map((row) => [`${row.provider}:${row.date}`, row]));
  const latencyByDay = new Map(latency.data.map((row) => [`${row.provider}:${row.date}`, row]));
  const dates = Array.from({ length: DAYS }, (_, i) =>
    new Date(from + i * DAY_MS).toISOString().slice(0, 10),
  );
  return {
    generatedAt: now.toISOString(),
    source: "live",
    timezone: "UTC",
    unit: "ms",
    window: { from: new Date(from).toISOString(), to: new Date(to).toISOString(), days: DAYS },
    policy: STATUS_POLICY,
    providers: PROVIDERS.map((provider) => ({
      ...provider,
      days: dates.map((date, i): ProviderDay => {
        const key = `${provider.id}:${date}`;
        const row = latencyByDay.get(key);
        const latencySamples = Number(row?.latencySamples ?? 0);
        const percentile = (value: Numeric | null | undefined) => {
          if (!latencySamples || value == null) return null;
          const number = Number(value);
          return Number.isFinite(number) && number >= 0 ? number : null;
        };
        return {
          date,
          partial: i === DAYS - 1,
          ...observations(healthByDay.get(key)),
          latency: {
            p50: percentile(row?.p50),
            p99: percentile(row?.p99),
            p999: percentile(row?.p999),
          },
          latencySamples,
          latencyRequests: Number(row?.latencyRequests ?? 0),
        };
      }),
    })),
  };
}
