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
  stations: {
    stationId: string;
    stationName: string;
    visits: number;
    uniqueVisitors: number;
    geo: { lat: number; lng: number } | null;
    type: "rail" | "metro" | "light";
    importance: 1 | 2 | 3 | 4;
  }[];
}

/**
 * Response from /stations/:id/stats endpoint
 */
export interface StationStatsResponse {
  station: {
    stationId: string;
    stationName: string;
    visits: number;
    uniqueVisitors: number;
  } | null;
  topStation: {
    stationId: string;
    stationName: string;
    visits: number;
    uniqueVisitors: number;
  } | null;
  comparison: {
    percentage: number | null;
    isTopStation: boolean;
  };
  period: string;
}

/**
 * Response from /stations/search?q=query endpoint
 * Returns array of Station objects
 */
export type StationSearchResponse = Station[];
