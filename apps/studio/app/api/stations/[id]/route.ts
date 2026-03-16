import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { Station, StationFeature, StationFeatureCollection } from "@repo/data";

const DATA_FILE_PATH = path.join(process.cwd(), "../..", "packages/data/src/stations.geojson");

async function readGeoJSON(): Promise<StationFeatureCollection> {
  const content = await fs.readFile(DATA_FILE_PATH, "utf-8");
  return JSON.parse(content);
}

async function writeGeoJSON(geojson: StationFeatureCollection): Promise<void> {
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(geojson), "utf-8");
}

function featureToStation(feature: StationFeature): Station {
  const [lng, lat] = feature.geometry.coordinates;
  return {
    id: feature.properties.id,
    name: feature.properties.name,
    type: feature.properties.type,
    importance: feature.properties.importance,
    geo: { lat: lat!, lng: lng! },
  };
}

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, geo, type, importance } = body;

    const geojson = await readGeoJSON();
    const index = geojson.features.findIndex((f) => f.properties.id === id);
    const existing = geojson.features[index];

    if (index === -1 || !existing) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }

    const existingStation = featureToStation(existing);

    const updatedType =
      type === "rail" || type === "metro" || type === "light" ? type : existingStation.type;
    const updatedImportance: 1 | 2 | 3 | 4 = [1, 2, 3, 4].includes(importance)
      ? importance
      : existingStation.importance;
    const updatedGeo = geo
      ? {
          lat: Math.round(Number(geo.lat) * 1e6) / 1e6,
          lng: Math.round(Number(geo.lng) * 1e6) / 1e6,
        }
      : existingStation.geo!;

    const updatedStation: Station = {
      id,
      name: name !== undefined ? String(name).trim() : existingStation.name,
      type: updatedType,
      importance: updatedImportance,
      geo: updatedGeo,
    };

    geojson.features[index] = {
      type: "Feature",
      properties: {
        id,
        name: updatedStation.name,
        type: updatedType,
        importance: updatedImportance,
      },
      geometry: {
        type: "Point",
        coordinates: [updatedGeo.lng, updatedGeo.lat],
      },
    };

    await writeGeoJSON(geojson);

    return NextResponse.json(updatedStation);
  } catch (error) {
    console.error("Failed to update station:", error);
    return NextResponse.json({ error: "Failed to update station" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const geojson = await readGeoJSON();
    const index = geojson.features.findIndex((f) => f.properties.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }

    const deleted = featureToStation(geojson.features[index]!);
    geojson.features.splice(index, 1);
    await writeGeoJSON(geojson);

    return NextResponse.json(deleted);
  } catch (error) {
    console.error("Failed to delete station:", error);
    return NextResponse.json({ error: "Failed to delete station" }, { status: 500 });
  }
}
