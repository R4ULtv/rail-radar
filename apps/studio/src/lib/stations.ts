import type { Station, StationFeature, StationFeatureCollection } from "@repo/data";

export type StationUpdates = {
  name?: string;
  geo?: { lat: number; lng: number } | null;
  type?: "rail" | "metro" | "light";
  importance?: 1 | 2 | 3 | 4;
};

export type StationFileFormat = "geojson" | "json" | "csv";
export type StationJsonRecord = {
  id: string;
  name: string;
  type: "rail" | "metro" | "light";
  importance: 1 | 2 | 3 | 4;
  lat: number | null;
  lng: number | null;
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

export function stationToJsonRecord(station: Station): StationJsonRecord {
  return {
    id: station.id,
    name: station.name,
    type: station.type,
    importance: station.importance,
    lat: station.geo?.lat ?? null,
    lng: station.geo?.lng ?? null,
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

export function stationsToJson(stations: Station[]): StationJsonRecord[] {
  return stations.map(stationToJsonRecord);
}

export function stationsToCsv(stations: Station[]): string {
  const rows = [
    ["id", "name", "type", "importance", "lat", "lng"],
    ...stations.map((station) => {
      const record = stationToJsonRecord(station);
      return [
        record.id,
        record.name,
        record.type,
        String(record.importance),
        record.lat === null ? "" : String(record.lat),
        record.lng === null ? "" : String(record.lng),
      ];
    }),
  ];

  return rows.map((row) => row.map((value) => escapeCsvField(value)).join(",")).join("\n");
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

function escapeCsvField(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (inQuotes) throw new Error("CSV contains an unterminated quoted field");
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function csvToStations(csv: string): Station[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one station");
  }

  const headers = parseCsvRow(lines[0]).map((header) => header.toLowerCase());
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  const requiredHeaders = ["id", "name", "type", "importance"];
  for (const header of requiredHeaders) {
    if (!headerIndex.has(header)) {
      throw new Error(`CSV is missing required "${header}" column`);
    }
  }

  const stations = lines.slice(1).map((line, rowIndex) => {
    const cells = parseCsvRow(line);
    const rowNumber = rowIndex + 2;

    const getCell = (header: string): string | undefined => {
      const index = headerIndex.get(header);
      return index === undefined ? undefined : cells[index];
    };

    return normalizeImportedStation(
      {
        id: getCell("id"),
        name: getCell("name"),
        type: getCell("type"),
        importance: getCell("importance"),
        lat: getCell("lat") ?? getCell("latitude"),
        lng: getCell("lng") ?? getCell("lon") ?? getCell("longitude"),
      },
      `CSV row ${rowNumber}`,
    );
  });

  return sortStationsByName(stations);
}

export function jsonToStations(value: unknown): Station[] {
  if (!Array.isArray(value)) {
    throw new Error("JSON station import must be an array");
  }

  const stations = value.map((item, index) =>
    normalizeImportedStation(item, `JSON item ${index + 1}`),
  );

  return sortStationsByName(stations);
}

export function parseStationFile(
  text: string,
  fileName?: string,
): {
  format: StationFileFormat;
  stations: Station[];
  sourceGeojson: StationFeatureCollection | null;
} {
  const normalizedFileName = fileName?.toLowerCase() ?? "";

  if (normalizedFileName.endsWith(".csv")) {
    return {
      format: "csv",
      stations: csvToStations(text),
      sourceGeojson: null,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    if (normalizedFileName.endsWith(".csv")) {
      return {
        format: "csv",
        stations: csvToStations(text),
        sourceGeojson: null,
      };
    }

    throw new Error("Failed to parse file as JSON or CSV");
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    (parsed as { type?: unknown }).type === "FeatureCollection"
  ) {
    const geojson = validateGeojson(parsed);
    return {
      format: "geojson",
      stations: geojsonToStations(geojson),
      sourceGeojson: geojson,
    };
  }

  return {
    format: "json",
    stations: jsonToStations(parsed),
    sourceGeojson: null,
  };
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

function normalizeImportedStation(input: unknown, sourceLabel: string): Station {
  if (!input || typeof input !== "object") {
    throw new Error(`${sourceLabel} must be an object`);
  }

  const record = input as {
    id?: unknown;
    name?: unknown;
    type?: unknown;
    importance?: unknown;
    lat?: unknown;
    lng?: unknown;
    lon?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    geo?: { lat?: unknown; lng?: unknown; lon?: unknown; latitude?: unknown; longitude?: unknown };
  };

  const id = normalizeImportedId(record.id, sourceLabel);
  const name = normalizeImportedName(record.name, sourceLabel);
  const type = normalizeImportedType(record.type, sourceLabel);
  const importance = normalizeImportedImportance(record.importance, sourceLabel);
  const lat = readCoordinateValue(
    record.lat ?? record.latitude ?? record.geo?.lat ?? record.geo?.latitude,
  );
  const lng = readCoordinateValue(
    record.lng ??
      record.lon ??
      record.longitude ??
      record.geo?.lng ??
      record.geo?.lon ??
      record.geo?.longitude,
  );

  if ((lat === null) !== (lng === null)) {
    throw new Error(`${sourceLabel} must include both lat and lng, or neither`);
  }

  return {
    id,
    name,
    type,
    importance,
    geo:
      lat === null || lng === null
        ? undefined
        : { lat: roundCoordinate(lat), lng: roundCoordinate(lng) },
  };
}

function normalizeImportedId(value: unknown, sourceLabel: string): string {
  if (typeof value !== "string" || !isValidStationId(value.trim())) {
    throw new Error(`${sourceLabel} has an invalid station ID`);
  }

  return value.trim();
}

function normalizeImportedName(value: unknown, sourceLabel: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${sourceLabel} is missing a station name`);
  }

  return value.trim();
}

function normalizeImportedType(value: unknown, sourceLabel: string): Station["type"] {
  if (value === "rail" || value === "metro" || value === "light") return value;
  throw new Error(`${sourceLabel} has an invalid station type`);
}

function normalizeImportedImportance(value: unknown, sourceLabel: string): 1 | 2 | 3 | 4 {
  const parsed =
    typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : typeof value === "number"
        ? value
        : NaN;

  if (parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4) {
    return parsed;
  }

  throw new Error(`${sourceLabel} has an invalid importance value`);
}

function readCoordinateValue(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  throw new Error("Invalid coordinate value");
}

function sortStationsByName(stations: Station[]): Station[] {
  return [...stations].sort((a, b) => a.name.localeCompare(b.name));
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
