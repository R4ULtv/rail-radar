import type { Feature, FeatureCollection, Point } from "geojson";

export interface Station {
  id: string;
  name: string;
  type: "rail" | "metro" | "light";
  importance: 1 | 2 | 3 | 4;
  geo?: {
    lat: number;
    lng: number;
  };
}

export interface StationProperties {
  id: string;
  name: string;
  type: "rail" | "metro" | "light";
  importance: 1 | 2 | 3 | 4;
  minzoom: number;
}

export type StationFeature = Feature<Point, StationProperties>;
export type StationFeatureCollection = FeatureCollection<Point, StationProperties>;

export interface Train {
  brand: string | null;
  category: string | null;
  trainNumber: string;
  origin?: string;
  destination?: string;
  scheduledTime: string;
  delay: number | null;
  platform: string | null;
  status: "incoming" | "departing" | "cancelled" | null;
  info: string | null;
}
