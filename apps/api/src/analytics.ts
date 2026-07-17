import { getPeriodInterval, STATION_ID_PATTERN, type Period } from "./constants";

import { COUNTRY_CODES, getCountry, type CountryCode } from "@repo/data/countries";

interface TopStation {
  stationId: string;
  stationName: string;
  country: CountryCode | null;
  visits: number;
  uniqueVisitors: number;
}

type TrendingSort = "visits" | "uniqueVisitors";

interface AnalyticsQueryResult {
  data: Array<{
    stationId: string;
    stationName: string;
    country: string;
    count: number;
    uniqueVisitors: number;
  }>;
}

interface CountryStats {
  country: CountryCode;
  visits: number;
  uniqueVisitors: number;
  stationsVisited: number;
}

interface AnalyticsOverview {
  totalVisits: number;
  uniqueVisitors: number;
  arrivalsCount: number;
  departuresCount: number;
  stationsVisited: number;
  countries: CountryStats[];
}

interface AnalyticsOverviewQueryResult {
  data: Array<{
    totalVisits: number;
    uniqueVisitors: number;
    arrivalsCount: number;
    departuresCount: number;
    stationsVisited: number;
  }>;
}

interface CountryBreakdownQueryResult {
  data: Array<{
    country: string;
    visits: number;
    uniqueVisitors: number;
    stationsVisited: number;
  }>;
}

export const PROVIDER_IDS = [
  "digitraffic",
  "entur",
  "irail",
  "irishrail",
  "ns",
  "opendata-ch",
  "rfi",
  "nationalrail",
  "sncf",
  "db",
  "rejseplanen",
  "plk",
  "trafiklab",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
export type ProviderMetricSource = "live" | "synthetic";
export type ProviderMetricResult = "success" | "error" | "timeout";

const COUNTRY_TO_PROVIDER: Partial<Record<CountryCode, ProviderId>> = {
  be: "irail",
  ch: "opendata-ch",
  de: "db",
  dk: "rejseplanen",
  fi: "digitraffic",
  ie: "irishrail",
  it: "rfi",
  nl: "ns",
  no: "entur",
  pl: "plk",
  se: "trafiklab",
  uk: "nationalrail",
  fr: "sncf",
};

async function hashIP(ip: string, pepper: string): Promise<string> {
  const encoder = new TextEncoder();
  if (!pepper) {
    // Local dev without the secret: fall back to the legacy unkeyed hash so
    // the Worker keeps functioning, but say so loudly.
    console.warn("IP_HASH_PEPPER is not set; falling back to unkeyed SHA-256");
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(ip));
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function queryAnalytics<T>(accountId: string, apiToken: string, query: string): Promise<T> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "text/plain",
      },
      body: query,
    },
  );

  if (!response.ok) {
    throw new Error(`Analytics query failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function recordStationVisit(
  analytics: AnalyticsEngineDataset,
  data: { stationId: string; stationName: string; ip: string; type: string; country: string },
  pepper: string,
): Promise<void> {
  const hashedIP = await hashIP(data.ip, pepper);
  analytics.writeDataPoint({
    blobs: [data.stationName, hashedIP, data.type, data.stationId, data.country],
    doubles: [],
    indexes: [data.stationId],
  });
}

export function isProviderId(value: string): value is ProviderId {
  return PROVIDER_IDS.includes(value as ProviderId);
}

export function getProviderByStationId(stationId: string): ProviderId | null {
  const country = getCountry(stationId);
  return country ? (COUNTRY_TO_PROVIDER[country] ?? null) : null;
}

export async function recordProviderMetric(
  analytics: AnalyticsEngineDataset,
  data: {
    provider: ProviderId;
    source: ProviderMetricSource;
    result: ProviderMetricResult;
    requestType: "arrivals" | "departures";
    stationId: string;
    country: CountryCode | "";
    fetchMs?: number | null;
    statusCode?: number | null;
  },
): Promise<void> {
  analytics.writeDataPoint({
    blobs: [
      data.provider,
      data.source,
      data.result,
      data.requestType,
      data.stationId,
      data.country,
    ],
    doubles: [data.fetchMs ?? -1, data.statusCode ?? -1],
    indexes: [data.provider],
  });
}

export async function getTrendingStations(
  accountId: string,
  apiToken: string,
  period: Period = "day",
  limit: number = 5,
  country?: CountryCode,
  sortBy: TrendingSort = "visits",
): Promise<TopStation[]> {
  const { value, unit } = getPeriodInterval(period);
  if (country && !COUNTRY_CODES.includes(country)) {
    throw new Error("Invalid country code");
  }
  const safeLimit = Number.isFinite(limit) ? Math.min(25, Math.max(1, Math.trunc(limit))) : 5;
  // SECURITY: `country` is validated against COUNTRY_CODES above. Do NOT
  // interpolate any value here that has not been checked against a fixed
  // allowlist/pattern — the Analytics Engine SQL API has no parameterization.
  const countryFilter = country ? `AND blob5 = '${country}'` : "";
  const orderColumn = sortBy === "uniqueVisitors" ? "uniqueVisitors" : "count";
  const secondaryOrderColumn = sortBy === "uniqueVisitors" ? "count" : "uniqueVisitors";
  const query = `
    SELECT
      index1 as stationId,
      argMax(blob1, timestamp) as stationName,
      argMax(blob5, timestamp) as country,
      sum(_sample_interval) as count,
      count(DISTINCT blob2) as uniqueVisitors
    FROM station_visits
    WHERE timestamp > NOW() - INTERVAL '${value}' ${unit}
    ${countryFilter}
    GROUP BY stationId
    ORDER BY ${orderColumn} DESC, ${secondaryOrderColumn} DESC, stationId ASC
    LIMIT ${safeLimit}
  `;

  const result = await queryAnalytics<AnalyticsQueryResult>(accountId, apiToken, query);

  return result.data.map((row) => ({
    stationId: row.stationId,
    stationName: row.stationName,
    country: (row.country as CountryCode) || getCountry(row.stationId),
    visits: Number(row.count),
    uniqueVisitors: Number(row.uniqueVisitors),
  }));
}

export async function getStationStats(
  accountId: string,
  apiToken: string,
  stationId: string,
  period: Period = "day",
): Promise<{ station: TopStation | null; topStation: TopStation | null }> {
  // SECURITY: Validate stationId format before use in SQL query.
  // Pattern ensures only alphanumeric station IDs like "IT1728" or "CH123".
  if (!STATION_ID_PATTERN.test(stationId)) {
    throw new Error("Invalid station ID");
  }

  const { value, unit } = getPeriodInterval(period);

  // SECURITY: `stationId` is validated against STATION_ID_PATTERN above. Do NOT
  // interpolate any value here that has not been checked against a fixed
  // allowlist/pattern — the Analytics Engine SQL API has no parameterization.
  const stationQuery = `
    SELECT
      index1 as stationId,
      argMax(blob1, timestamp) as stationName,
      sum(_sample_interval) as count,
      count(DISTINCT blob2) as uniqueVisitors
    FROM station_visits
    WHERE timestamp > NOW() - INTERVAL '${value}' ${unit}
      AND index1 = '${stationId}'
    GROUP BY stationId
  `;

  const [stationResult, trendingResult] = await Promise.all([
    queryAnalytics<AnalyticsQueryResult>(accountId, apiToken, stationQuery),
    getTrendingStations(accountId, apiToken, period, 1, undefined, "uniqueVisitors"),
  ]);

  const stationData = stationResult.data[0];
  const station = stationData
    ? {
        stationId: stationData.stationId,
        stationName: stationData.stationName,
        country: getCountry(stationData.stationId),
        visits: Number(stationData.count),
        uniqueVisitors: Number(stationData.uniqueVisitors),
      }
    : null;

  const topStation = trendingResult[0] ?? null;

  return { station, topStation };
}

export async function getAnalyticsOverview(
  accountId: string,
  apiToken: string,
): Promise<AnalyticsOverview> {
  const overviewQuery = `
    SELECT
      sum(_sample_interval) as totalVisits,
      count(DISTINCT blob2) as uniqueVisitors,
      sumIf(_sample_interval, blob3 = 'arrivals') as arrivalsCount,
      sumIf(_sample_interval, blob3 = 'departures') as departuresCount,
      count(DISTINCT index1) as stationsVisited
    FROM station_visits
  `;

  const countryQuery = `
    SELECT
      blob5 as country,
      sum(_sample_interval) as visits,
      count(DISTINCT blob2) as uniqueVisitors,
      count(DISTINCT index1) as stationsVisited
    FROM station_visits
    WHERE blob5 != ''
    GROUP BY blob5
    ORDER BY visits DESC
  `;

  const [overviewResult, countryResult] = await Promise.all([
    queryAnalytics<AnalyticsOverviewQueryResult>(accountId, apiToken, overviewQuery),
    queryAnalytics<CountryBreakdownQueryResult>(accountId, apiToken, countryQuery),
  ]);

  return {
    totalVisits: overviewResult.data[0]?.totalVisits ?? 0,
    uniqueVisitors: overviewResult.data[0]?.uniqueVisitors ?? 0,
    arrivalsCount: overviewResult.data[0]?.arrivalsCount ?? 0,
    departuresCount: overviewResult.data[0]?.departuresCount ?? 0,
    stationsVisited: overviewResult.data[0]?.stationsVisited ?? 0,
    countries: countryResult.data.map((row) => ({
      country: row.country as CountryCode,
      visits: Number(row.visits),
      uniqueVisitors: Number(row.uniqueVisitors),
      stationsVisited: Number(row.stationsVisited),
    })),
  };
}
