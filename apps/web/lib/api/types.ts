/**
 * Centralized API response type definitions
 * Consolidates types previously duplicated across components
 */

import type { Train, Station } from "@repo/data";

/**
 * Response from /stations/:id endpoint
 * Used for fetching train arrivals/departures
 */
export interface TrainDataResponse {
  timestamp: string;
  info: string | null;
  trains: Train[];
}

/**
 * Response from /stations/trending endpoint
 */
export interface TrendingStationsResponse {
  timestamp: string;
  period: string;
  stations: TrendingStation[];
}

export interface TrendingStation {
  stationId: number;
  stationName: string;
  visits: number;
  uniqueVisitors: number;
}

/**
 * Response from /stations/:id/stats endpoint
 */
export interface StationStatsResponse {
  station: StationData | null;
  topStation: StationData | null;
  comparison: {
    percentage: number | null;
    isTopStation: boolean;
  };
  period: string;
}

export interface StationData {
  stationId: number;
  stationName: string;
  visits: number;
  uniqueVisitors: number;
}

/**
 * Response from /stations?q=query endpoint
 * Returns array of Station objects
 */
export type StationSearchResponse = Station[];

/**
 * Response from /rfi/status endpoint
 */
export interface RfiStatusResponse {
  timestamp: string;
  period: string;
  count: number;
  avgFetchMs: number;
  p50FetchMs: number;
  p95FetchMs: number;
  p99FetchMs: number;
  successCount: number;
  successRate: number;
}
