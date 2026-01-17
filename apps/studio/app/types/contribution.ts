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
  nameChanged?: boolean;
}

export interface StationChange {
  id: number;
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
  stationsRenamed: number;
  stationsCreated: number;
  stationsDeleted: number;
  initialCoverage: number;
  currentCoverage: number;
}
