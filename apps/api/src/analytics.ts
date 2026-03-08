import { getPeriodInterval, STATION_ID_PATTERN, type Period } from "./constants";

import { COUNTRY_CODES, getCountry, type CountryCode } from "@repo/data/stations";

interface TopStation {
  stationId: string;
  stationName: string;
  country: CountryCode | null;
  visits: number;
  uniqueVisitors: number;
}

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

async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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
): Promise<void> {
  const hashedIP = await hashIP(data.ip);
  analytics.writeDataPoint({
    blobs: [data.stationName, hashedIP, data.type, data.stationId, data.country],
    doubles: [],
    indexes: [data.stationId],
  });
}

export async function getTrendingStations(
  accountId: string,
  apiToken: string,
  period: Period = "day",
  limit: number = 5,
  country?: CountryCode,
): Promise<TopStation[]> {
  const { value, unit } = getPeriodInterval(period);
  if (country && !COUNTRY_CODES.includes(country)) {
    throw new Error("Invalid country code");
  }
  const countryFilter = country ? `AND blob5 = '${country}'` : "";
  const query = `
    SELECT
      index1 as stationId,
      blob1 as stationName,
      blob5 as country,
      sum(_sample_interval) as count,
      count(DISTINCT blob2) as uniqueVisitors
    FROM station_visits
    WHERE timestamp > NOW() - INTERVAL '${value}' ${unit}
    ${countryFilter}
    GROUP BY index1, blob1, blob5
    ORDER BY count DESC
  `;

  const result = await queryAnalytics<AnalyticsQueryResult>(accountId, apiToken, query);

  // Normalize old numeric IDs (e.g. "1728") to new format ("IT1728") and merge
  const merged = new Map<string, TopStation>();
  for (const row of result.data) {
    const id = /^\d+$/.test(row.stationId) ? `IT${row.stationId}` : row.stationId;
    const rowCountry = (row.country as CountryCode) || getCountry(id);
    const visits = Number(row.count);
    const unique = Number(row.uniqueVisitors);
    const existing = merged.get(id);
    if (existing) {
      existing.visits += visits;
      existing.uniqueVisitors += unique;
    } else {
      merged.set(id, {
        stationId: id,
        stationName: row.stationName,
        country: rowCountry,
        visits,
        uniqueVisitors: unique,
      });
    }
  }

  return [...merged.values()].sort((a, b) => b.visits - a.visits).slice(0, limit);
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

  // Extract numeric part to match old format data too
  const numericId = stationId.replace(/^[A-Z]+/, "");
  const stationQuery = `
    SELECT
      '${stationId}' as stationId,
      blob1 as stationName,
      sum(_sample_interval) as count,
      count(DISTINCT blob2) as uniqueVisitors
    FROM station_visits
    WHERE timestamp > NOW() - INTERVAL '${value}' ${unit}
      AND (index1 = '${stationId}' OR index1 = '${numericId}')
    GROUP BY blob1
  `;

  const [stationResult, trendingResult] = await Promise.all([
    queryAnalytics<AnalyticsQueryResult>(accountId, apiToken, stationQuery),
    getTrendingStations(accountId, apiToken, period, 1),
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
