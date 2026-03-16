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

function stationToFeature(station: Station): StationFeature {
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
      coordinates: [station.geo!.lng, station.geo!.lat],
    },
  };
}

export async function GET() {
  try {
    const geojson = await readGeoJSON();
    const stations = geojson.features.map(featureToStation);
    const sorted = stations.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(sorted);
  } catch (error) {
    console.error("Failed to read stations:", error);
    return NextResponse.json({ error: "Failed to read stations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, geo, type, importance } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!geo || typeof geo.lat !== "number" || typeof geo.lng !== "number") {
      return NextResponse.json({ error: "Coordinates are required" }, { status: 400 });
    }

    const geojson = await readGeoJSON();

    const newId = `IT-R-${Date.now()}`;
    const newStation: Station = {
      id: newId,
      name: name.trim(),
      type: type === "metro" ? "metro" : type === "light" ? "light" : "rail",
      importance: [1, 2, 3, 4].includes(importance) ? importance : 4,
      geo: {
        lat: Math.round(Number(geo.lat) * 1e6) / 1e6,
        lng: Math.round(Number(geo.lng) * 1e6) / 1e6,
      },
    };

    geojson.features.push(stationToFeature(newStation));
    await writeGeoJSON(geojson);

    return NextResponse.json(newStation, { status: 201 });
  } catch (error) {
    console.error("Failed to create station:", error);
    return NextResponse.json({ error: "Failed to create station" }, { status: 500 });
  }
}
