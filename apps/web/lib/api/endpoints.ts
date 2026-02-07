/**
 * Type-safe URL builders for all API endpoints
 * Centralizes endpoint construction logic
 */

/**
 * Build URL for station search endpoint
 * @param query - Search query string
 */
export function stationSearch(query: string): string {
  return `/stations?q=${encodeURIComponent(query)}`;
}

/**
 * Build URL for trending stations endpoint
 * @param period - Time period for trending data (default: "week")
 */
export function trendingStations(period: string = "week"): string {
  return `/stations/trending?period=${period}`;
}

/**
 * Build URL for station trains endpoint (arrivals/departures)
 * @param stationId - Station ID
 * @param type - Type of trains to fetch
 */
export function stationTrains(
  stationId: number,
  type: "arrivals" | "departures",
): string {
  return `/stations/${stationId}?type=${type}`;
}

/**
 * Build URL for station statistics endpoint
 * @param stationId - Station ID
 * @param period - Time period for stats (default: "week")
 */
export function stationStats(
  stationId: number,
  period: string = "week",
): string {
  return `/stations/${stationId}/stats?period=${period}`;
}

/**
 * Build URL for RFI status endpoint
 * @param period - Time period for status data (default: "day")
 */
export function rfiStatus(period: string = "day"): string {
  return `/rfi/status?period=${period}`;
}
