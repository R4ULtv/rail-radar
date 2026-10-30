/**
 * Centralized API response type definitions
 * Consolidates types previously duplicated across components
 */

import type { Line, LineGeometry, Station, Train } from "@repo/data";

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
    type: Station["type"];
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

/** A stop in a /lines.geojson?include=stops response. */
export type LineStop = Pick<Station, "name" | "type" | "importance" | "geo"> & {
  /** Every line serving the stop, including ones outside the response. */
  lines: string[];
};

/**
 * Response from /lines.geojson?id=…&include=stops endpoint
 * One Feature per requested line, plus the stops of those lines
 */
export interface LinesGeoJsonResponse {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    id: string;
    properties: Line;
    geometry: LineGeometry | null;
  }[];
  stops: Record<string, LineStop>;
}

/** One line's track and stops, as the web app keeps it. */
export interface LineData {
  id: string;
  geometry: LineGeometry | null;
  /** Every stop on any of the line's routes, by station ID. */
  stops: Record<string, LineStop>;
}
