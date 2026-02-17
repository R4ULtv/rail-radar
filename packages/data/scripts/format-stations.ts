/**
 * Format stations.json
 *
 * This script normalizes the stations.json file by:
 * 1. Sorting all stations alphabetically by name
 * 2. Minifying the output (removing whitespace)
 *
 * Run with: pnpm --filter=@repo/data format-stations
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Resolve path to stations.json relative to this script
const stationsPath = join(import.meta.dirname, "../src/stations.json");

// Load and parse the stations data
const stations = JSON.parse(readFileSync(stationsPath, "utf-8"));

// Sort stations alphabetically by name using locale-aware comparison
stations.sort((a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name),
);

// Write back as minified JSON (no whitespace)
writeFileSync(stationsPath, JSON.stringify(stations));

console.log(`Formatted ${stations.length} stations (sorted by name, minified)`);
