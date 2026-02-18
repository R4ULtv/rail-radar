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
  stationId: string;
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
  stationId: string;
  stationName: string;
  visits: number;
  uniqueVisitors: number;
}

/**
 * Response from /stations?q=query endpoint
 * Returns array of Station objects
 */
export type StationSearchResponse = Station[];
