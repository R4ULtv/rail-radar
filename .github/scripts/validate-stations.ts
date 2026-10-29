#!/usr/bin/env node

/** Dependency-free station validation and PR reporting. Run directly with Node 24. */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { FreightKind, StationProperties } from "../../packages/data/src/types.ts";

// Keep these exhaustive against the shared schema without loading application dependencies.
const stationTypes = {
  rail: "Rail",
  metro: "Metro",
  light: "Light rail",
  freight: "Freight",
} satisfies Record<StationProperties["type"], string>;
const freightKinds = {
  marshalling: "Marshalling yard",
  intermodal: "Intermodal terminal",
  port: "Port terminal",
} satisfies Record<FreightKind, string>;

// Input is deliberately untrusted: even malformed stations must produce a useful report.
interface StationFeature {
  properties: Record<string, unknown> & { id: string };
  geometry?: unknown;
}

interface ValidationError {
  stationId: unknown;
  stationName: unknown;
  field: string;
  message: string;
}

interface Change {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

interface DiffResult {
  added: StationFeature[];
  removed: StationFeature[];
  modified: Array<{ base: StationFeature; head: StationFeature; changes: Change[] }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKey<T extends object>(object: T, key: unknown): key is keyof T {
  return typeof key === "string" && Object.hasOwn(object, key);
}

function loadFeatures(path: string): unknown[] {
  const data: unknown = JSON.parse(readFileSync(path, "utf-8"));
  if (!isRecord(data) || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error(`${path}: expected a GeoJSON FeatureCollection with a features array`);
  }
  return data.features;
}

function coordinates(feature: StationFeature): unknown[] {
  return isRecord(feature.geometry) && Array.isArray(feature.geometry.coordinates)
    ? feature.geometry.coordinates
    : [];
}

function validateFeatures(features: unknown[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenIds = new Map<string, unknown>();

  for (const [index, feature] of features.entries()) {
    const props = isRecord(feature) && isRecord(feature.properties) ? feature.properties : {};
    const addError = (field: string, message: string) => {
      errors.push({
        stationId: props.id ?? `index ${index}`,
        stationName: props.name ?? "(unnamed)",
        field,
        message,
      });
    };

    if (!isRecord(feature) || feature.type !== "Feature" || !isRecord(feature.properties)) {
      addError("feature", "Expected a GeoJSON Feature with a properties object");
      continue;
    }

    if (typeof props.id !== "string" || props.id.trim() === "" || /[\r\n]/.test(props.id)) {
      addError("id", "ID must be a non-empty string without line breaks");
    } else {
      if (seenIds.has(props.id)) {
        addError("id", `Duplicate ID (also used by "${seenIds.get(props.id)}")`);
      }
      seenIds.set(props.id, props.name);
    }

    if (typeof props.name !== "string" || props.name.trim() === "") {
      addError("name", "Name must be a non-empty string");
    }
    if (!hasKey(stationTypes, props.type)) {
      addError("type", `Invalid type: ${props.type} (must be rail, metro, light, or freight)`);
    }
    if (![1, 2, 3, 4].includes(props.importance as number)) {
      addError("importance", `Invalid importance: ${props.importance} (must be 1-4)`);
    }
    if (props.kind !== undefined) {
      if (!hasKey(freightKinds, props.kind)) {
        addError(
          "kind",
          `Invalid freight kind: ${props.kind} (must be marshalling, intermodal, or port)`,
        );
      }
      if (props.type !== "freight") {
        addError("kind", "Kind can only be set on freight stations");
      }
    }

    if (!isRecord(feature.geometry) || feature.geometry.type !== "Point") {
      addError("geometry", "Geometry must be a GeoJSON Point");
    }
    const coords = isRecord(feature.geometry) ? feature.geometry.coordinates : undefined;
    if (!Array.isArray(coords) || coords.length < 2) {
      addError("geometry", "Missing coordinates (expected [longitude, latitude])");
    } else {
      const [lng, lat] = coords;
      if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
        addError("geometry.lat", `Invalid latitude: ${lat} (must be -90 to 90)`);
      }
      if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        addError("geometry.lng", `Invalid longitude: ${lng} (must be -180 to 180)`);
      }
    }
  }

  return errors;
}

function indexFeatures(features: unknown[]): Map<string, StationFeature> {
  const result = new Map<string, StationFeature>();
  for (const feature of features) {
    if (
      isRecord(feature) &&
      isRecord(feature.properties) &&
      typeof feature.properties.id === "string"
    ) {
      result.set(feature.properties.id, feature as unknown as StationFeature);
    }
  }
  return result;
}

function compareFeatures(base: StationFeature, head: StationFeature): Change[] {
  const changes: Change[] = [];
  for (const field of ["name", "type", "importance", "kind"]) {
    if (base.properties[field] !== head.properties[field]) {
      changes.push({ field, oldValue: base.properties[field], newValue: head.properties[field] });
    }
  }
  const before = coordinates(base);
  const after = coordinates(head);
  // Object key order is irrelevant, but geometry type and every coordinate matter.
  const baseType = isRecord(base.geometry) ? base.geometry.type : undefined;
  const headType = isRecord(head.geometry) ? head.geometry.type : undefined;
  if (baseType !== headType || JSON.stringify(before) !== JSON.stringify(after)) {
    changes.push({ field: "location", oldValue: base.geometry, newValue: head.geometry });
  }
  return changes;
}

function computeDiff(baseFeatures: unknown[], headFeatures: unknown[]): DiffResult {
  const baseMap = indexFeatures(baseFeatures);
  const headMap = indexFeatures(headFeatures);
  const diff: DiffResult = { added: [], removed: [], modified: [] };
  for (const [id, head] of headMap) {
    const base = baseMap.get(id);
    if (!base) {
      diff.added.push(head);
    } else {
      const changes = compareFeatures(base, head);
      if (changes.length > 0) diff.modified.push({ base, head, changes });
    }
  }
  for (const [id, base] of baseMap) {
    if (!headMap.has(id)) diff.removed.push(base);
  }
  // Stable order makes large imports and rerun comments easier to compare.
  const byId = (a: StationFeature, b: StationFeature) =>
    a.properties.id.localeCompare(b.properties.id, "en", { numeric: true });
  diff.added.sort(byId);
  diff.removed.sort(byId);
  diff.modified.sort((a, b) => byId(a.head, b.head));
  return diff;
}

// Escape untrusted data in every table cell, including HTML, Markdown, and line breaks.
function cell(value: unknown, full: boolean): string {
  if (value === undefined) return "—";
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  const text = !full && raw.length > 160 ? `${raw.slice(0, 157)}…` : raw;
  return text
    .replace(/[\r\n]+/g, " ")
    .replace(/[&<>`*_[\]~\\|@]/g, (char) => `&#${char.charCodeAt(0)};`);
}

function location(value: unknown, full: boolean): string {
  if (!isRecord(value) || value.type !== "Point" || !Array.isArray(value.coordinates)) {
    return cell(value, full);
  }
  const [lng, lat] = value.coordinates;
  if (
    typeof lng !== "number" ||
    !Number.isFinite(lng) ||
    Math.abs(lng) > 180 ||
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    Math.abs(lat) > 90
  ) {
    return cell(value, full);
  }
  const link = `[${lat}, ${lng}](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng})`;
  return value.coordinates.length > 2
    ? `${link} (extra: ${cell(value.coordinates.slice(2), full)})`
    : link;
}

function fieldValue(field: string, value: unknown, full: boolean): string {
  if (field === "location") return location(value, full);
  if (field === "type" && hasKey(stationTypes, value)) return stationTypes[value];
  if (field === "kind" && hasKey(freightKinds, value)) return freightKinds[value];
  return cell(value, full);
}

function generateReport(
  diff: DiffResult,
  errors: ValidationError[],
  baseCount: number,
  headCount: number,
  limit: number,
  reportUrl?: string,
  comparisonFailed = false,
): string {
  const full = limit === Infinity;
  const changed = diff.added.length + diff.removed.length + diff.modified.length;
  const lines = [
    "<!-- station-data-check -->",
    "## Station data review",
    "",
    errors.length > 0
      ? `❌ **Validation failed — ${errors.length} error${errors.length === 1 ? "" : "s"}.** Fix these before merging.`
      : `✅ **Validation passed** — ${headCount.toLocaleString("en")} stations checked.`,
    "",
  ];

  if (comparisonFailed) {
    lines.push(
      "**Station changes could not be compared because an input file could not be read.**",
      "",
    );
  } else {
    lines.push(
      "| Added | Modified | Removed | Total stations |",
      "| ---: | ---: | ---: | ---: |",
      `| +${diff.added.length} | ${diff.modified.length} | −${diff.removed.length} | ${baseCount.toLocaleString("en")} → ${headCount.toLocaleString("en")} |`,
      "",
    );
  }

  if (changed > 0) {
    lines.push("| Station type | Added | Modified¹ | Removed |", "| --- | ---: | ---: | ---: |");
    for (const type of [...Object.keys(stationTypes), "other"]) {
      const matches = (feature: StationFeature) =>
        type === "other"
          ? !hasKey(stationTypes, feature.properties.type)
          : feature.properties.type === type;
      const added = diff.added.filter(matches).length;
      const modified = diff.modified.filter(({ head }) => matches(head)).length;
      const removed = diff.removed.filter(matches).length;
      if (added + modified + removed > 0) {
        lines.push(
          `| ${hasKey(stationTypes, type) ? stationTypes[type] : "Invalid / unknown"} | ${added} | ${modified} | ${removed} |`,
        );
      }
    }
    lines.push("", "¹ Modified stations are counted under their new type.", "");
  }

  function section(
    title: string,
    count: number,
    headers: string[],
    rows: string[][],
    open = false,
  ) {
    if (count === 0) return;
    const shown = Math.min(count, limit);
    lines.push(
      `<details${open ? " open" : ""}>`,
      `<summary><strong>${title} (${count})</strong></summary>`,
      "",
      `| ${headers.join(" | ")} |`,
      `| ${headers.map(() => "---").join(" | ")} |`,
    );
    for (const row of rows) lines.push(`| ${row.join(" | ")} |`);
    lines.push("");
    if (shown < count)
      lines.push(`_Showing ${shown} of ${count}. All entries are in the full report._`, "");
    lines.push("</details>", "");
  }

  section(
    "❌ Validation errors",
    errors.length,
    ["ID", "Station", "Field", "Problem"],
    errors
      .slice(0, limit)
      .map((error) =>
        [error.stationId, error.stationName, error.field, error.message].map((value) =>
          cell(value, full),
        ),
      ),
    true,
  );

  for (const [title, features] of [
    ["➕ Added stations", diff.added],
    ["➖ Removed stations", diff.removed],
  ] as const) {
    section(
      title,
      features.length,
      ["ID", "Station", "Type", "Freight kind", "Importance", "Location (lat, lng)"],
      features
        .slice(0, limit)
        .map(({ properties: props, geometry }) => [
          cell(props.id, full),
          cell(props.name, full),
          fieldValue("type", props.type, full),
          fieldValue("kind", props.kind, full),
          cell(props.importance, full),
          location(geometry, full),
        ]),
    );
  }

  section(
    "✏️ Modified stations",
    diff.modified.length,
    ["ID", "Station", "Field", "Before", "After"],
    diff.modified
      .slice(0, limit)
      .flatMap(({ head, changes }) =>
        changes.map((change) => [
          cell(head.properties.id, full),
          cell(head.properties.name, full),
          cell(change.field, full),
          fieldValue(change.field, change.oldValue, full),
          fieldValue(change.field, change.newValue, full),
        ]),
      ),
  );

  if (changed === 0 && !comparisonFailed) lines.push("_No station data changes detected._", "");
  if (errors.length > 0)
    lines.push(
      "_Change tables use stations with string IDs; fix invalid or duplicate IDs before relying on their counts._",
      "",
    );
  if (!full) {
    lines.push(
      reportUrl
        ? `[Download the full station-data-report from this workflow run](${reportUrl}).`
        : "_Use --full-output=<path> to save every change and validation error._",
      "",
    );
  }
  return lines.join("\n");
}

function main() {
  const { values } = parseArgs({
    options: {
      base: { type: "string" },
      head: { type: "string" },
      output: { type: "string" },
      "full-output": { type: "string" },
      "report-url": { type: "string" },
    },
  });
  if (!values.base || !values.head || !values.output) {
    throw new Error(
      "Usage: validate-stations.ts --base=<path> --head=<path> --output=<path> [--full-output=<path>] [--report-url=<https-url>]",
    );
  }
  if (values["report-url"] && !/^https:\/\/[^\s<>()[\]]+$/.test(values["report-url"])) {
    throw new Error("Report URL must be an HTTPS URL without Markdown delimiters");
  }

  let base: unknown[] = [];
  let head: unknown[] = [];
  let diff: DiffResult = { added: [], removed: [], modified: [] };
  let errors: ValidationError[];
  let comparisonFailed = false;
  try {
    base = loadFeatures(values.base);
    head = loadFeatures(values.head);
    errors = validateFeatures(head);
    diff = computeDiff(base, head);
  } catch (error) {
    comparisonFailed = true;
    errors = [{ stationId: "(file)", stationName: "—", field: "file", message: String(error) }];
  }

  const report = (limit: number) =>
    generateReport(
      diff,
      errors,
      base.length,
      head.length,
      limit,
      values["report-url"],
      comparisonFailed,
    );
  // Leave room below GitHub's comment limit, even for large imports or invalid data.
  let limit = 50;
  let comment = report(limit);
  while (Buffer.byteLength(comment, "utf-8") > 60_000 && limit > 0) {
    limit = Math.floor(limit / 2);
    comment = report(limit);
  }
  writeFileSync(values.output, comment);
  if (values["full-output"]) writeFileSync(values["full-output"], report(Infinity));
  // This script runs directly in GitHub Actions, outside Turbo's task cache.
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    appendFileSync(githubOutput, `has_errors=${errors.length > 0}\n`);
  }
  console.log(`Report generated: ${values.output}`);
  console.log(`Validation errors: ${errors.length}`);
  console.log(
    `Added: ${diff.added.length}, Removed: ${diff.removed.length}, Modified: ${diff.modified.length}`,
  );
  // The workflow posts the report before failing its final step on has_errors.
  // Local CLI runs still return a useful failure status.
  if (errors.length > 0 && !githubOutput) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error("Error:", error);
  process.exitCode = 1;
}
