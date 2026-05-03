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
  coordinatesUpdated?: boolean;
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
}

export interface ContributionStats {
  changesCount: number;
  coordinatesUpdated: number;
  stationsRenamed: number;
  stationsCreated: number;
  stationsDeleted: number;
}
