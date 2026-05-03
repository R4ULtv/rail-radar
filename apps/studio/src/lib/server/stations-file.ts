import fs from "node:fs/promises";
import path from "node:path";
import type { StationFeatureCollection } from "@repo/data";
import { validateGeojson } from "$lib/stations";

const DATA_FILE_PATH = path.join(process.cwd(), "../..", "packages/data/src/stations.geojson");

export async function readGeojsonFile(): Promise<StationFeatureCollection> {
  const content = await fs.readFile(DATA_FILE_PATH, "utf-8");
  return validateGeojson(JSON.parse(content));
}

export async function writeGeojsonFile(geojson: StationFeatureCollection): Promise<void> {
  const sorted: StationFeatureCollection = {
    ...geojson,
    features: [...geojson.features].sort((a, b) => a.properties.id.localeCompare(b.properties.id)),
  };
  const serialized = JSON.stringify(sorted, null, 2).replace(
    /"coordinates": \[\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*\]/g,
    '"coordinates": [$1, $2]',
  );
  await fs.writeFile(DATA_FILE_PATH, serialized + "\n", "utf-8");
}
