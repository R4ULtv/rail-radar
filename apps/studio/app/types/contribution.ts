export type ChangeType = "created" | "updated" | "deleted";

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface ChangeDetails {
  previousName?: string;
  newName?: string;
  previousGeo?: GeoCoordinates | null;
  newGeo?: GeoCoordinates | null;
  coordinatesAdded?: boolean;
  coordinatesUpdated?: boolean;
  coordinatesRemoved?: boolean;
  nameChanged?: boolean;
  typeChanged?: boolean;
  previousType?: string;
  newType?: string;
  importanceChanged?: boolean;
  previousImportance?: number;
  newImportance?: number;
}

export interface StationChange {
  id: string;
  type: ChangeType;
  stationName: string;
  timestamp: Date;
  details: ChangeDetails;
}

export interface ContributionSession {
  startedAt: Date;
  changes: StationChange[];
  initialCoverage: number;
}

export interface ContributionStats {
  changesCount: number;
  coordinatesAdded: number;
  coordinatesUpdated: number;
  coordinatesRemoved: number;
  stationsRenamed: number;
  stationsCreated: number;
  stationsDeleted: number;
  initialCoverage: number;
  currentCoverage: number;
}
