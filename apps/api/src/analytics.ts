interface TopStation {
  stationId: string;
  stationName: string;
  visits: number;
  uniqueVisitors: number;
}

interface AnalyticsQueryResult {
  data: Array<{
    stationId: string;
    stationName: string;
    count: number;
    uniqueVisitors: number;
  }>;
}

interface AnalyticsOverview {
  totalVisits: number;
  uniqueVisitors: number;
  arrivalsCount: number;
  departuresCount: number;
  stationsVisited: number;
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

async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function queryAnalytics<T>(
  accountId: string,
  apiToken: string,
  query: string,
): Promise<T> {
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
  data: { stationId: string; stationName: string; ip: string; type: string },
): Promise<void> {
  const hashedIP = await hashIP(data.ip);
  analytics.writeDataPoint({
    blobs: [data.stationName, hashedIP, data.type, data.stationId],
    indexes: [data.stationId],
  });
}

export async function getTrendingStations(
  accountId: string,
  apiToken: string,
  period: "hour" | "day" | "week" = "day",
  limit: number = 5,
): Promise<TopStation[]> {
  const intervalValue = { hour: 1, day: 1, week: 7 }[period];
  const intervalUnit = period === "week" ? "DAY" : period.toUpperCase();
  const query = `
    SELECT
      blob4 as stationId,
      blob1 as stationName,
      count() as count,
      count(DISTINCT blob2) as uniqueVisitors
    FROM station_visits
    WHERE timestamp > NOW() - INTERVAL '${intervalValue}' ${intervalUnit}
    GROUP BY blob4, blob1
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  const result = await queryAnalytics<AnalyticsQueryResult>(
    accountId,
    apiToken,
    query,
  );

  return result.data.map((row) => ({
    stationId: row.stationId,
    stationName: row.stationName,
    visits: row.count,
    uniqueVisitors: row.uniqueVisitors,
  }));
}

export async function getStationStats(
  accountId: string,
  apiToken: string,
  stationId: string,
  period: "hour" | "day" | "week" = "day",
): Promise<{ station: TopStation | null; topStation: TopStation | null }> {
  const intervals = { hour: 1, day: 1, week: 7 } as const;
  const units = { hour: "HOUR", day: "DAY", week: "DAY" } as const;
  const intervalValue = intervals[period];
  const intervalUnit = units[period];

  const stationQuery = `
    SELECT
      blob4 as stationId,
      blob1 as stationName,
      count() as count,
      count(DISTINCT blob2) as uniqueVisitors
    FROM station_visits
    WHERE timestamp > NOW() - INTERVAL '${intervalValue}' ${intervalUnit}
      AND index1 = '${stationId}'
    GROUP BY blob4, blob1
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
        visits: stationData.count,
        uniqueVisitors: stationData.uniqueVisitors,
      }
    : null;

  const topStation = trendingResult[0] ?? null;

  return { station, topStation };
}

export async function getAnalyticsOverview(
  accountId: string,
  apiToken: string,
): Promise<AnalyticsOverview> {
  const query = `
    SELECT
      count() as totalVisits,
      count(DISTINCT blob2) as uniqueVisitors,
      countIf(blob3 = 'arrivals') as arrivalsCount,
      countIf(blob3 = 'departures') as departuresCount,
      count(DISTINCT blob4) as stationsVisited
    FROM station_visits
  `;

  const result = await queryAnalytics<AnalyticsOverviewQueryResult>(
    accountId,
    apiToken,
    query,
  );

  return {
    totalVisits: result.data[0]?.totalVisits ?? 0,
    uniqueVisitors: result.data[0]?.uniqueVisitors ?? 0,
    arrivalsCount: result.data[0]?.arrivalsCount ?? 0,
    departuresCount: result.data[0]?.departuresCount ?? 0,
    stationsVisited: result.data[0]?.stationsVisited ?? 0,
  };
}

export async function recordRfiRequest(
  analytics: AnalyticsEngineDataset,
  data: {
    fetchMs: number;
    success: boolean;
  },
): Promise<void> {
  analytics.writeDataPoint({
    doubles: [data.fetchMs, data.success ? 1 : 0],
    indexes: [new Date().toISOString()],
  });
}


interface RfiStatusResult {
  count: number;
  avgFetchMs: number;
  p50FetchMs: number;
  p95FetchMs: number;
  p99FetchMs: number;
  successCount: number;
  successRate: number;
}

export async function getRfiStatus(
  accountId: string,
  apiToken: string,
  period: "hour" | "day" | "week" = "day",
): Promise<RfiStatusResult> {
  const intervalValue = { hour: 1, day: 1, week: 7 }[period];
  const intervalUnit = period === "week" ? "DAY" : period.toUpperCase();

  // Get count and success stats (using _sample_interval to account for sampling)
  const statsQuery = `
    SELECT
      sum(_sample_interval) as count,
      sum(double1 * _sample_interval) / sum(_sample_interval) as avgFetchMs,
      sumIf(_sample_interval, double2 = 1) as successCount
    FROM rfi_requests
    WHERE timestamp > NOW() - INTERVAL '${intervalValue}' ${intervalUnit}
  `;

  const statsResult = await queryAnalytics<{
    data: Array<{ count: number; avgFetchMs: number; successCount: number }>;
  }>(accountId, apiToken, statsQuery);

  const statsData = statsResult.data[0];
  const count = statsData?.count ?? 0;
  const successCount = statsData?.successCount ?? 0;
  const avgFetchMs = statsData?.avgFetchMs ?? 0;
  const successRate = count > 0 ? (successCount / count) * 100 : 0;

  // Get percentiles using quantileExactWeighted
  const percentileQuery = `
    SELECT
      quantileExactWeighted(0.5)(double1, _sample_interval) as p50FetchMs,
      quantileExactWeighted(0.95)(double1, _sample_interval) as p95FetchMs,
      quantileExactWeighted(0.99)(double1, _sample_interval) as p99FetchMs
    FROM rfi_requests
    WHERE timestamp > NOW() - INTERVAL '${intervalValue}' ${intervalUnit}
  `;

  const percentileResult = await queryAnalytics<{
    data: Array<{ p50FetchMs: number; p95FetchMs: number; p99FetchMs: number }>;
  }>(accountId, apiToken, percentileQuery);

  const percentileData = percentileResult.data[0];
  const p50FetchMs = percentileData?.p50FetchMs ?? 0;
  const p95FetchMs = percentileData?.p95FetchMs ?? 0;
  const p99FetchMs = percentileData?.p99FetchMs ?? 0;

  return {
    count,
    avgFetchMs,
    p50FetchMs,
    p95FetchMs,
    p99FetchMs,
    successCount,
    successRate,
  };
}
