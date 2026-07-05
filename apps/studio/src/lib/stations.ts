import type { Station, StationFeature, StationFeatureCollection } from "@repo/data";

export type StationUpdates = {
  name?: string;
  geo?: { lat: number; lng: number } | null;
  type?: "rail" | "metro" | "light";
  importance?: 1 | 2 | 3 | 4;
};

export function roundCoordinate(value: number): number {
  return Math.round(Number(value) * 1e6) / 1e6;
}

export function featureToStation(feature: StationFeature): Station {
  const [lng, lat] = feature.geometry.coordinates;
  return {
    id: feature.properties.id,
    name: feature.properties.name,
    type: feature.properties.type,
    importance: feature.properties.importance,
    geo: { lat: lat!, lng: lng! },
  };
}

export function stationToFeature(station: Station): StationFeature {
  if (!station.geo) {
    throw new Error("Station coordinates are required");
  }

  return {
    type: "Feature",
    properties: {
      id: station.id,
      name: station.name,
      type: station.type,
      importance: station.importance,
    },
    geometry: {
      type: "Point",
      coordinates: [station.geo.lng, station.geo.lat],
    },
  };
}

export function geojsonToStations(geojson: StationFeatureCollection): Station[] {
  return geojson.features.map(featureToStation).sort((a, b) => a.name.localeCompare(b.name));
}

export function stationsToGeojson(stations: Station[]): StationFeatureCollection {
  return {
    type: "FeatureCollection",
    features: stations.filter((station) => station.geo).map(stationToFeature),
  };
}

export function validateGeojson(value: unknown): StationFeatureCollection {
  if (!value || typeof value !== "object") {
    throw new Error("GeoJSON must be an object");
  }

  const geojson = value as StationFeatureCollection;
  if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
    throw new Error("Expected a GeoJSON FeatureCollection");
  }

  for (const feature of geojson.features) {
    if (
      feature.type !== "Feature" ||
      feature.geometry?.type !== "Point" ||
      !Array.isArray(feature.geometry.coordinates) ||
      typeof feature.properties?.id !== "string" ||
      typeof feature.properties.name !== "string"
    ) {
      throw new Error("GeoJSON contains an unsupported station feature");
    }
  }

  return geojson;
}

export const STATION_ID_PATTERN = /^[A-Z]{2,3}\d{3,}$/;

export function isValidStationId(id: string): boolean {
  return STATION_ID_PATTERN.test(id);
}

export function normalizeNewStation(input: {
  id?: unknown;
  name: unknown;
  geo: unknown;
  type: unknown;
  importance: unknown;
}): Station {
  const { id, name, geo, type, importance } = input;
  if (!name || typeof name !== "string") {
    throw new Error("Name is required");
  }

  if (
    !geo ||
    typeof geo !== "object" ||
    typeof (geo as { lat?: unknown }).lat !== "number" ||
    typeof (geo as { lng?: unknown }).lng !== "number"
  ) {
    throw new Error("Coordinates are required");
  }

  if (typeof id !== "string" || !isValidStationId(id)) {
    throw new Error(
      "ID must be a 2-3 letter country prefix followed by at least 3 digits (e.g. IT123, ITM042, BE11007)",
    );
  }

  const stationType = type === "metro" ? "metro" : type === "light" ? "light" : "rail";
  const stationImportance =
    importance === 1 || importance === 2 || importance === 3 || importance === 4 ? importance : 4;
  const coordinates = geo as { lat: number; lng: number };

  return {
    id,
    name: name.trim(),
    type: stationType,
    importance: stationImportance,
    geo: {
      lat: roundCoordinate(coordinates.lat),
      lng: roundCoordinate(coordinates.lng),
    },
  };
}

export function applyStationUpdates(station: Station, updates: StationUpdates): Station {
  const updatedType =
    updates.type === "rail" || updates.type === "metro" || updates.type === "light"
      ? updates.type
      : station.type;
  const updatedImportance =
    updates.importance === 1 ||
    updates.importance === 2 ||
    updates.importance === 3 ||
    updates.importance === 4
      ? updates.importance
      : station.importance;
  const updatedGeo =
    updates.geo === undefined
      ? station.geo // keep existing
      : updates.geo === null
        ? undefined // explicit clear
        : { lat: roundCoordinate(updates.geo.lat), lng: roundCoordinate(updates.geo.lng) };

  return {
    id: station.id,
    name: updates.name !== undefined ? String(updates.name).trim() : station.name,
    type: updatedType,
    importance: updatedImportance,
    geo: updatedGeo,
  };
}
