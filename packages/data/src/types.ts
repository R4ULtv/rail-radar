import type { Feature, FeatureCollection, Point } from "geojson";
import type { CountryCode } from "./countries";

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

export type ServiceType =
  | "high-speed"
  | "intercity"
  | "regional"
  | "commuter"
  | "night-train"
  | "international"
  | "scenic";

export type OperatorType = "passenger" | "cargo" | "metro" | "light-rail";
export type OperatorCountry = CountryCode | "international";

export interface OperatorLink {
  label: string;
  url: string;
  type: "website" | "timetables" | "api" | "wikipedia";
}

/** [west, south, east, north] longitude/latitude bounding box */
export type OperatorBounds = [number, number, number, number];

export interface Operator {
  slug: string;
  name: string;
  logoPath: string;
  countries: OperatorCountry[];
  operatorTypes: OperatorType[];
  bounds: OperatorBounds;
  description: string;
  website: string;
  founded: number | null;
  headquarters: string | null;
  networkKm: number | null;
  annualPassengers: number | null;
  serviceTypes: ServiceType[];
  parentCompany: string | null;
  links: OperatorLink[];
}
