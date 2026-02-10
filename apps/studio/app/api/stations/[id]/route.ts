import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { Station } from "@repo/data";

const DATA_FILE_PATH = path.join(
  process.cwd(),
  "../..",
  "packages/data/src/stations.json",
);

async function readStations(): Promise<Station[]> {
  const content = await fs.readFile(DATA_FILE_PATH, "utf-8");
  return JSON.parse(content);
}

async function writeStations(stations: Station[]): Promise<void> {
  const content = JSON.stringify(stations);
  await fs.writeFile(DATA_FILE_PATH, content, "utf-8");
}

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, geo, type, importance } = body;

    const stations = await readStations();
    const index = stations.findIndex((s) => s.id === id);
    const existingStation = stations[index];

    if (index === -1 || !existingStation) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }

    const updatedStation: Station = {
      id,
      name: name !== undefined ? String(name).trim() : existingStation.name,
      type: type === "rail" || type === "metro" ? type : existingStation.type,
      importance: [1, 2, 3, 4].includes(importance) ? importance : existingStation.importance,
      geo: geo
        ? {
            lat: Math.round(Number(geo.lat) * 1e6) / 1e6,
            lng: Math.round(Number(geo.lng) * 1e6) / 1e6,
          }
        : geo === null
          ? undefined
          : existingStation.geo,
    };

    stations[index] = updatedStation;
    await writeStations(stations);

    return NextResponse.json(updatedStation);
  } catch (error) {
    console.error("Failed to update station:", error);
    return NextResponse.json(
      { error: "Failed to update station" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const stations = await readStations();
    const index = stations.findIndex((s) => s.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }

    const deletedStation = stations[index];
    stations.splice(index, 1);
    await writeStations(stations);

    return NextResponse.json(deletedStation);
  } catch (error) {
    console.error("Failed to delete station:", error);
    return NextResponse.json(
      { error: "Failed to delete station" },
      { status: 500 },
    );
  }
}
