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

export async function GET() {
  try {
    const stations = await readStations();
    const sorted = stations.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(sorted);
  } catch (error) {
    console.error("Failed to read stations:", error);
    return NextResponse.json(
      { error: "Failed to read stations" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, geo, type, importance } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const stations = await readStations();

    // Generate a new ID
    const newId = `IT-R-${Date.now()}`;
    const newStation: Station = {
      id: newId,
      name: name.trim(),
      type: type === "metro" ? "metro" : type === "light" ? "light" : "rail",
      importance: [1, 2, 3, 4].includes(importance) ? importance : 4,
      geo: geo
        ? {
            lat: Math.round(Number(geo.lat) * 1e6) / 1e6,
            lng: Math.round(Number(geo.lng) * 1e6) / 1e6,
          }
        : undefined,
    };

    stations.push(newStation);
    await writeStations(stations);

    return NextResponse.json(newStation, { status: 201 });
  } catch (error) {
    console.error("Failed to create station:", error);
    return NextResponse.json(
      { error: "Failed to create station" },
      { status: 500 },
    );
  }
}
