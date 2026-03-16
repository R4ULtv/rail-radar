#!/usr/bin/env npx tsx

/**
 * Station Data Validator and Diff Reporter
 *
 * Validates stations.geojson and generates a PR comment
 * with statistics and detailed change information.
 */

import { readFileSync, writeFileSync, appendFileSync } from "fs";
import { parseArgs } from "util";

interface StationProperties {
  id: string;
  name: string;
  type: "rail" | "metro" | "light";
  importance: 1 | 2 | 3 | 4;
}

interface StationFeature {
  type: "Feature";
  properties: StationProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

interface StationGeoJSON {
  type: "FeatureCollection";
  features: StationFeature[];
}

interface ValidationError {
  stationId: string;
  stationName: string;
  field: string;
  message: string;
}

interface DiffResult {
  added: StationFeature[];
  removed: StationFeature[];
  modified: Array<{
    id: string;
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

function loadGeoJSON(path: string): StationGeoJSON {
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content);
}

// --- Validation ---

function validateFeatures(features: StationFeature[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenIds = new Map<string, string>();

  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    const props = feature.properties;

    // Check ID exists and is a string
    if (typeof props.id !== "string" || props.id.trim() === "") {
      errors.push({
        stationId: props.id || `index ${i}`,
        stationName: props.name || `index ${i}`,
        field: "id",
        message: `ID is not a valid string: ${JSON.stringify(props.id)}`,
      });
      continue;
    }

    // Check for duplicate IDs
    if (seenIds.has(props.id)) {
      errors.push({
        stationId: props.id,
        stationName: props.name,
        field: "id",
        message: `Duplicate ID (also used by "${seenIds.get(props.id)}")`,
      });
    }
    seenIds.set(props.id, props.name);

    // Check name is non-empty string
    if (typeof props.name !== "string" || props.name.trim() === "") {
      errors.push({
        stationId: props.id,
        stationName: props.name || "(empty)",
        field: "name",
        message: "Name must be a non-empty string",
      });
    }

    // Validate type
    if (!["rail", "metro", "light"].includes(props.type)) {
      errors.push({
        stationId: props.id,
        stationName: props.name,
        field: "type",
        message: `Invalid type: ${props.type} (must be rail, metro, or light)`,
      });
    }

    // Validate importance
    if (![1, 2, 3, 4].includes(props.importance)) {
      errors.push({
        stationId: props.id,
        stationName: props.name,
        field: "importance",
        message: `Invalid importance: ${props.importance} (must be 1-4)`,
      });
    }

    // Validate geometry
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) {
      errors.push({
        stationId: props.id,
        stationName: props.name,
        field: "geometry",
        message: "Missing coordinates",
      });
    } else {
      const [lng, lat] = coords;
      if (typeof lat !== "number" || lat < -90 || lat > 90) {
        errors.push({
          stationId: props.id,
          stationName: props.name,
          field: "geometry.lat",
          message: `Invalid latitude: ${lat} (must be -90 to 90)`,
        });
      }
      if (typeof lng !== "number" || lng < -180 || lng > 180) {
        errors.push({
          stationId: props.id,
          stationName: props.name,
          field: "geometry.lng",
          message: `Invalid longitude: ${lng} (must be -180 to 180)`,
        });
      }
    }
  }

  return errors;
}

// --- Diff Computation ---

function computeDiff(baseFeatures: StationFeature[], headFeatures: StationFeature[]): DiffResult {
  const baseMap = new Map(baseFeatures.map((f) => [f.properties.id, f]));
  const headMap = new Map(headFeatures.map((f) => [f.properties.id, f]));

  const added: StationFeature[] = [];
  const removed: StationFeature[] = [];
  const modified: DiffResult["modified"] = [];

  for (const [id, headFeature] of headMap) {
    const baseFeature = baseMap.get(id);

    if (!baseFeature) {
      added.push(headFeature);
    } else {
      const changes = compareFeatures(baseFeature, headFeature);
      if (changes.length > 0) {
        modified.push({ id, name: headFeature.properties.name, changes });
      }
    }
  }

  for (const [id, baseFeature] of baseMap) {
    if (!headMap.has(id)) {
      removed.push(baseFeature);
    }
  }

  return { added, removed, modified };
}

function compareFeatures(
  base: StationFeature,
  head: StationFeature,
): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
  const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

  if (base.properties.name !== head.properties.name) {
    changes.push({ field: "name", oldValue: base.properties.name, newValue: head.properties.name });
  }

  if (base.properties.type !== head.properties.type) {
    changes.push({ field: "type", oldValue: base.properties.type, newValue: head.properties.type });
  }

  if (base.properties.importance !== head.properties.importance) {
    changes.push({
      field: "importance",
      oldValue: base.properties.importance,
      newValue: head.properties.importance,
    });
  }

  const [baseLng, baseLat] = base.geometry.coordinates;
  const [headLng, headLat] = head.geometry.coordinates;

  if (baseLat !== headLat) {
    changes.push({ field: "lat", oldValue: baseLat, newValue: headLat });
  }
  if (baseLng !== headLng) {
    changes.push({ field: "lng", oldValue: baseLng, newValue: headLng });
  }

  return changes;
}

// --- Report Generation ---

function formatCoords(feature: StationFeature): string {
  const [lng, lat] = feature.geometry.coordinates;
  return `${lat}, ${lng}`;
}

function generateReport(diff: DiffResult, errors: ValidationError[]): string {
  const lines: string[] = [];

  lines.push("<!-- station-data-check -->");
  lines.push("## Station Data Change Report");
  lines.push("");

  // Validation errors
  if (errors.length > 0) {
    lines.push("<details>");
    lines.push(
      `<summary><strong>:warning: Validation Errors (${errors.length})</strong></summary>`,
    );
    lines.push("");
    lines.push("| Station ID | Station Name | Field | Error |");
    lines.push("|------------|--------------|-------|-------|");
    for (const error of errors) {
      lines.push(
        `| ${error.stationId} | ${escapeMarkdown(error.stationName)} | \`${error.field}\` | ${escapeMarkdown(error.message)} |`,
      );
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  // Added stations
  if (diff.added.length > 0) {
    lines.push("<details>");
    lines.push(
      `<summary><strong>:heavy_plus_sign: Stations Added (${diff.added.length})</strong></summary>`,
    );
    lines.push("");
    lines.push("| ID | Name | Type | Coordinates |");
    lines.push("|----|------|------|-------------|");
    for (const feature of diff.added.slice(0, 50)) {
      lines.push(
        `| ${feature.properties.id} | ${escapeMarkdown(feature.properties.name)} | ${feature.properties.type} | ${formatCoords(feature)} |`,
      );
    }
    if (diff.added.length > 50) {
      lines.push(`| ... | _${diff.added.length - 50} more stations_ | ... | ... |`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  // Removed stations
  if (diff.removed.length > 0) {
    lines.push("<details>");
    lines.push(
      `<summary><strong>:heavy_minus_sign: Stations Removed (${diff.removed.length})</strong></summary>`,
    );
    lines.push("");
    lines.push("| ID | Name | Type | Coordinates |");
    lines.push("|----|------|------|-------------|");
    for (const feature of diff.removed.slice(0, 50)) {
      lines.push(
        `| ${feature.properties.id} | ${escapeMarkdown(feature.properties.name)} | ${feature.properties.type} | ${formatCoords(feature)} |`,
      );
    }
    if (diff.removed.length > 50) {
      lines.push(`| ... | _${diff.removed.length - 50} more stations_ | ... | ... |`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  // Modified stations
  if (diff.modified.length > 0) {
    lines.push("<details>");
    lines.push(
      `<summary><strong>:pencil2: Stations Modified (${diff.modified.length})</strong></summary>`,
    );
    lines.push("");
    for (const mod of diff.modified.slice(0, 30)) {
      lines.push(`#### Station ${mod.id}: ${escapeMarkdown(mod.name)}`);
      lines.push("");
      lines.push("| Field | Old Value | New Value |");
      lines.push("|-------|-----------|-----------|");
      for (const change of mod.changes) {
        lines.push(
          `| \`${change.field}\` | ${formatValue(change.oldValue)} | ${formatValue(change.newValue)} |`,
        );
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
  const baseGeoJSON = loadGeoJSON(basePath);
  const headGeoJSON = loadGeoJSON(headPath);

  const errors = validateFeatures(headGeoJSON.features);
  const diff = computeDiff(baseGeoJSON.features, headGeoJSON.features);

  const report = generateReport(diff, errors);

  writeFileSync(outputPath, report);

  // Set GitHub Actions output
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `has_errors=${errors.length > 0}\n`);
  }

  console.log(`Report generated: ${outputPath}`);
  console.log(`Validation errors: ${errors.length}`);
  console.log(
    `Added: ${diff.added.length}, Removed: ${diff.removed.length}, Modified: ${diff.modified.length}`,
  );
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
