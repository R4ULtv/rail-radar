/**
 * Record a station visit to Analytics Engine
 */
export async function recordStationVisit(
  analytics: AnalyticsEngineDataset,
  data: { stationId: number; stationName: string },
): Promise<void> {
  analytics.writeDataPoint({
    blobs: [data.stationName],
    doubles: [data.stationId],
    indexes: [data.stationId.toString()],
  });
}

interface TopStation {
  stationId: number;
  stationName: string;
  visits: number;
}

interface AnalyticsQueryResult {
  data: Array<{
    double1: number;
    blob1: string;
    count: number;
  }>;
}

/**
 * Query SQL API for top visited stations
 */
export async function getTopStations(
  accountId: string,
  apiToken: string,
  limit: number = 5,
): Promise<TopStation[]> {
  const query = `
    SELECT
      double1 as stationId,
      blob1 as stationName,
      count() as count
    FROM station_visits
    GROUP BY double1, blob1
    ORDER BY count DESC
    LIMIT ${limit}
  `;

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

  const result = (await response.json()) as AnalyticsQueryResult;

  return result.data.map((row) => ({
    stationId: row.double1,
    stationName: row.blob1,
    visits: row.count,
  }));
}

/**
 * Query SQL API for specific station visits
 */
export async function getStationVisits(
  accountId: string,
  apiToken: string,
  stationId: number,
): Promise<number> {
  const query = `
    SELECT count() as count
    FROM station_visits
    WHERE double1 = ${stationId}
  `;

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

  const result = (await response.json()) as { data: Array<{ count: number }> };

  return result.data[0]?.count ?? 0;
}
