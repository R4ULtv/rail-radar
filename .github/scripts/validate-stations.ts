#!/usr/bin/env npx tsx

/**
 * Station Data Validator and Diff Reporter
 *
 * Validates stations-with-coords.json and generates a PR comment
 * with statistics and detailed change information.
 */

import { readFileSync, writeFileSync, appendFileSync } from "fs";
import { parseArgs } from "util";

// Types matching packages/data/src/types.ts
interface Station {
  id: number;
  name: string;
  geo?: {
    lat: number;
    lng: number;
  };
}

interface ValidationError {
  stationId: number | "unknown";
  stationName: string;
  field: string;
  message: string;
}

interface DiffResult {
  added: Station[];
  removed: Station[];
  modified: Array<{
    id: number;
    name: string;
    changes: Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }>;
  }>;
}

// --- Argument Parsing ---

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    head: { type: "string" },
    output: { type: "string" },
  },
});

const basePath = values.base;
const headPath = values.head;
const outputPath = values.output;

if (!basePath || !headPath || !outputPath) {
  console.error("Usage: validate-stations.ts --base=<path> --head=<path> --output=<path>");
  process.exit(1);
}

// --- File Loading ---

function loadStations(path: string): Station[] {
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content);
}

// --- Validation ---

function validateStations(stations: Station[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenIds = new Map<number, string>();

  for (let i = 0; i < stations.length; i++) {
    const station = stations[i];

    // Check ID exists and is a number
    if (typeof station.id !== "number") {
      errors.push({
        stationId: "unknown",
        stationName: station.name || `index ${i}`,
        field: "id",
        message: `ID is not a number: ${JSON.stringify(station.id)}`,
      });
      continue;
    }

    // Check for duplicate IDs
    if (seenIds.has(station.id)) {
      errors.push({
        stationId: station.id,
        stationName: station.name,
        field: "id",
        message: `Duplicate ID (also used by "${seenIds.get(station.id)}")`,
      });
    }
    seenIds.set(station.id, station.name);

    // Check name is non-empty string
    if (typeof station.name !== "string" || station.name.trim() === "") {
      errors.push({
        stationId: station.id,
        stationName: station.name || "(empty)",
        field: "name",
        message: "Name must be a non-empty string",
      });
    }

    // Validate geo coordinates if present
    if (station.geo !== undefined) {
      if (typeof station.geo.lat !== "number" || station.geo.lat < -90 || station.geo.lat > 90) {
        errors.push({
          stationId: station.id,
          stationName: station.name,
          field: "geo.lat",
          message: `Invalid latitude: ${station.geo.lat} (must be -90 to 90)`,
        });
      }

      if (typeof station.geo.lng !== "number" || station.geo.lng < -180 || station.geo.lng > 180) {
        errors.push({
          stationId: station.id,
          stationName: station.name,
          field: "geo.lng",
          message: `Invalid longitude: ${station.geo.lng} (must be -180 to 180)`,
        });
      }
    }
  }

  return errors;
}

// --- Diff Computation ---

function computeDiff(baseStations: Station[], headStations: Station[]): DiffResult {
  const baseMap = new Map(baseStations.map((s) => [s.id, s]));
  const headMap = new Map(headStations.map((s) => [s.id, s]));

  const added: Station[] = [];
  const removed: Station[] = [];
  const modified: DiffResult["modified"] = [];

  // Find added and modified
  for (const [id, headStation] of headMap) {
    const baseStation = baseMap.get(id);

    if (!baseStation) {
      added.push(headStation);
    } else {
      const changes = compareStations(baseStation, headStation);
      if (changes.length > 0) {
        modified.push({
          id,
          name: headStation.name,
          changes,
        });
      }
    }
  }

  // Find removed
  for (const [id, baseStation] of baseMap) {
    if (!headMap.has(id)) {
      removed.push(baseStation);
    }
  }

  return { added, removed, modified };
}

function compareStations(
  base: Station,
  head: Station
): Array<{
  field: string;
  oldValue: unknown;
  newValue: unknown;
}> {
  const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

  if (base.name !== head.name) {
    changes.push({ field: "name", oldValue: base.name, newValue: head.name });
  }

  const baseGeo = base.geo;
  const headGeo = head.geo;

  if (!baseGeo && headGeo) {
    changes.push({ field: "geo", oldValue: undefined, newValue: headGeo });
  } else if (baseGeo && !headGeo) {
    changes.push({ field: "geo", oldValue: baseGeo, newValue: undefined });
  } else if (baseGeo && headGeo) {
    if (baseGeo.lat !== headGeo.lat) {
      changes.push({ field: "geo.lat", oldValue: baseGeo.lat, newValue: headGeo.lat });
    }
    if (baseGeo.lng !== headGeo.lng) {
      changes.push({ field: "geo.lng", oldValue: baseGeo.lng, newValue: headGeo.lng });
    }
  }

  return changes;
}

// --- Report Generation ---

function generateReport(
  diff: DiffResult,
  errors: ValidationError[],
  baseCount: number,
  headCount: number
): string {
  const lines: string[] = [];

  lines.push("<!-- station-data-check -->");
  lines.push("## Station Data Change Report");
  lines.push("");

  // Summary statistics
  lines.push("### Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Total stations (before) | ${baseCount} |`);
  lines.push(`| Total stations (after) | ${headCount} |`);
  lines.push(`| Stations added | ${diff.added.length} |`);
  lines.push(`| Stations removed | ${diff.removed.length} |`);
  lines.push(`| Stations modified | ${diff.modified.length} |`);
  lines.push(`| Validation errors | ${errors.length} |`);
  lines.push("");

  // Status badge
  if (errors.length > 0) {
    lines.push("> **Status:** :x: Validation failed");
  } else {
    lines.push("> **Status:** :white_check_mark: All validations passed");
  }
  lines.push("");

  // Validation errors
  if (errors.length > 0) {
    lines.push("<details>");
    lines.push("<summary><strong>:warning: Validation Errors (" + errors.length + ")</strong></summary>");
    lines.push("");
    lines.push("| Station ID | Station Name | Field | Error |");
    lines.push("|------------|--------------|-------|-------|");
    for (const error of errors) {
      lines.push(
        `| ${error.stationId} | ${escapeMarkdown(error.stationName)} | \`${error.field}\` | ${escapeMarkdown(error.message)} |`
      );
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  // Added stations
  if (diff.added.length > 0) {
    lines.push("<details>");
    lines.push("<summary><strong>:heavy_plus_sign: Stations Added (" + diff.added.length + ")</strong></summary>");
    lines.push("");
    lines.push("| ID | Name | Coordinates |");
    lines.push("|----|------|-------------|");
    for (const station of diff.added.slice(0, 50)) {
      const coords = station.geo ? `${station.geo.lat}, ${station.geo.lng}` : "_No coordinates_";
      lines.push(`| ${station.id} | ${escapeMarkdown(station.name)} | ${coords} |`);
    }
    if (diff.added.length > 50) {
      lines.push(`| ... | _${diff.added.length - 50} more stations_ | ... |`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  // Removed stations
  if (diff.removed.length > 0) {
    lines.push("<details>");
    lines.push("<summary><strong>:heavy_minus_sign: Stations Removed (" + diff.removed.length + ")</strong></summary>");
    lines.push("");
    lines.push("| ID | Name | Coordinates |");
    lines.push("|----|------|-------------|");
    for (const station of diff.removed.slice(0, 50)) {
      const coords = station.geo ? `${station.geo.lat}, ${station.geo.lng}` : "_No coordinates_";
      lines.push(`| ${station.id} | ${escapeMarkdown(station.name)} | ${coords} |`);
    }
    if (diff.removed.length > 50) {
      lines.push(`| ... | _${diff.removed.length - 50} more stations_ | ... |`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  // Modified stations
  if (diff.modified.length > 0) {
    lines.push("<details>");
    lines.push("<summary><strong>:pencil2: Stations Modified (" + diff.modified.length + ")</strong></summary>");
    lines.push("");
    for (const mod of diff.modified.slice(0, 30)) {
      lines.push(`#### Station ${mod.id}: ${escapeMarkdown(mod.name)}`);
      lines.push("");
      lines.push("| Field | Old Value | New Value |");
      lines.push("|-------|-----------|-----------|");
      for (const change of mod.changes) {
        lines.push(`| \`${change.field}\` | ${formatValue(change.oldValue)} | ${formatValue(change.newValue)} |`);
      }
      lines.push("");
    }
    if (diff.modified.length > 30) {
      lines.push(`_... and ${diff.modified.length - 30} more modified stations_`);
      lines.push("");
    }
    lines.push("</details>");
    lines.push("");
  }

  // No changes case
  if (diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0) {
    lines.push("_No changes detected in station data._");
    lines.push("");
  }

  return lines.join("\n");
}

function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatValue(value: unknown): string {
  if (value === undefined) return "_undefined_";
  if (value === null) return "_null_";
  if (typeof value === "object") return `\`${JSON.stringify(value)}\``;
  return `\`${value}\``;
}

// --- Main ---

async function main() {
  const baseStations = loadStations(basePath);
  const headStations = loadStations(headPath);

  const errors = validateStations(headStations);
  const diff = computeDiff(baseStations, headStations);

  const report = generateReport(diff, errors, baseStations.length, headStations.length);

  writeFileSync(outputPath, report);

  // Set GitHub Actions output
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `has_errors=${errors.length > 0}\n`);
  }

  console.log(`Report generated: ${outputPath}`);
  console.log(`Validation errors: ${errors.length}`);
  console.log(`Added: ${diff.added.length}, Removed: ${diff.removed.length}, Modified: ${diff.modified.length}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
