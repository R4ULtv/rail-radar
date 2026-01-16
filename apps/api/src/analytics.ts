/**
 * Hash an IP address using SHA-256 for privacy-preserving unique visitor tracking
 */
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Record a station visit to Analytics Engine
 */
export async function recordStationVisit(
  analytics: AnalyticsEngineDataset,
  data: { stationId: number; stationName: string; ip: string; type: string },
): Promise<void> {
  const hashedIP = await hashIP(data.ip);
  analytics.writeDataPoint({
    blobs: [data.stationName, hashedIP, data.type],
    doubles: [data.stationId],
    indexes: [data.stationId.toString()],
  });
}

interface TopStation {
  stationId: number;
  stationName: string;
  visits: number;
  uniqueVisitors: number;
}

interface AnalyticsQueryResult {
  data: Array<{
    stationId: number;
    stationName: string;
    count: number;
    uniqueVisitors: number;
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
      count() as count,
      count(DISTINCT blob2) as uniqueVisitors
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
    stationId: row.stationId,
    stationName: row.stationName,
    visits: row.count,
    uniqueVisitors: row.uniqueVisitors,
  }));
}

interface StationVisitsResult {
  visits: number;
  uniqueVisitors: number;
}

/**
 * Query SQL API for specific station visits
 */
export async function getStationVisits(
  accountId: string,
  apiToken: string,
  stationId: number,
): Promise<StationVisitsResult> {
  const query = `
    SELECT
      count() as count,
      count(DISTINCT blob2) as uniqueVisitors
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

  const result = (await response.json()) as {
    data: Array<{ count: number; uniqueVisitors: number }>;
  };

  return {
    visits: result.data[0]?.count ?? 0,
    uniqueVisitors: result.data[0]?.uniqueVisitors ?? 0,
  };
}
