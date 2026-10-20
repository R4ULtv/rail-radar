import type { Feature, FeatureCollection, MultiLineString, Point } from "geojson";
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

/** One distinct branch; the reverse journey uses the same station list backwards. */
export interface LineRoute {
  /** Public route/service number when branches have their own codes, e.g. Stockholm 10. */
  code?: string;
  /** Ordered canonical station IDs; the first and last are the termini. */
  stations: string[];
}

/** A publicly named metro or light rail line, with one or more routes. */
export interface Line {
  /** Permanent public identifier: country, network, then code or short name (it-milano-m1). */
  id: string;
  /** Public line code, such as A, M1 or T1; null when the service has no code. */
  code: string | null;
  /** Public line name in the local language, without termini. */
  name: string;
  /** Hand-written overview for the line's page, in English; omitted until written. */
  description?: string;
  type: "metro" | "light";
  /** Uppercase #RRGGBB, or null when the operator publishes no line color. */
  color: string | null;
  /** Operator slug, matching `slug` in operators.json. */
  operator: string | null;
  /** Distinct branches; short trips within another branch are not listed. */
  routes: LineRoute[];
}

/** Track of every branch of a line, stored separately in src/lines/<line-id>.json. */
export type LineGeometry = MultiLineString;

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
