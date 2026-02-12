export const CACHE_TTL = {
  STATION_DATA: "public, max-age=25, stale-while-revalidate=5",
  ANALYTICS: "public, max-age=300, stale-while-revalidate=60",
  RFI_STATUS: "public, max-age=300, stale-while-revalidate=60",
} as const;

export const FETCH_TIMEOUT_MS = 30_000;

export const FUZZY_SEARCH_LIMIT = 20;
export const TRENDING_LIMIT = 5;

export const VALID_PERIODS = ["hour", "day", "week"] as const;
export type Period = (typeof VALID_PERIODS)[number];

export const PERIOD_INTERVALS = {
  hour: { value: 1, unit: "HOUR" },
  day: { value: 1, unit: "DAY" },
  week: { value: 7, unit: "DAY" },
} as const;

export function getPeriodInterval(period: Period) {
  return PERIOD_INTERVALS[period];
}

// Station ID validation pattern for SQL injection prevention
// SECURITY: Only allows alphanumeric station IDs like "IT1728" or "CH123"
export const STATION_ID_PATTERN = /^[A-Z]{2,3}\d+$/;
