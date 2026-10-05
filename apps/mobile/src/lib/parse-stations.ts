import type { Station, StationFeature, StationFeatureCollection } from "@repo/data/types";

const parseBudgetMs = 4;
const maxBatchFeatures = 64;
const scanCheckInterval = 256;

function appendStations(stations: Station[], features: StationFeature[]) {
  for (const { properties, geometry } of features) {
    stations.push({
      id: properties.id,
      name: properties.name,
      type: properties.type,
      importance: properties.importance,
      geo: { lat: geometry.coordinates[1]!, lng: geometry.coordinates[0]! },
    });
  }
}

/**
 * The bundled file and API use this envelope and put each feature's type first. Native
 * regexp searches find those boundaries without visiting every JSON token in JS. A name
 * cannot contain this delimiter: its quotes would be escaped. Other valid GeoJSON layouts
 * use the structural scanner below, including any batch split inside a nested feature.
 */
async function parseGeneratedStations(text: string): Promise<Station[] | null> {
  const start =
    /^[ \t\r\n]*\{[ \t\r\n]*"type"[ \t\r\n]*:[ \t\r\n]*"FeatureCollection"[ \t\r\n]*,[ \t\r\n]*"features"[ \t\r\n]*:[ \t\r\n]*\[/.exec(
      text,
    );
  // Search backwards from the end instead of scanning all station coordinate arrays.
  const end = text.lastIndexOf("]");
  if (!start || end < start[0].length || !/^[ \t\r\n]*\}[ \t\r\n]*$/.test(text.slice(end + 1))) {
    return null;
  }

  const separators =
    /,[ \t\r\n]*(?=\{[ \t\r\n]*"type"[ \t\r\n]*:[ \t\r\n]*"Feature"[ \t\r\n]*[,}])/g;
  const stations: Station[] = [];
  let batchStart = start[0].length;
  separators.lastIndex = batchStart;
  let count = 0;
  let batchStartedAt = performance.now();

  function append(endAt: number) {
    // Unusual property order or a very large feature takes the yielding scanner instead
    // of accidentally falling back to one large JSON.parse.
    if (endAt - batchStart > 32_768) return false;
    appendStations(stations, JSON.parse(`[${text.slice(batchStart, endAt)}]`) as StationFeature[]);
    return true;
  }

  try {
    let separator: RegExpExecArray | null;
    while ((separator = separators.exec(text)) !== null && separator.index < end) {
      if (++count < maxBatchFeatures) continue;
      if (!append(separator.index)) return null;
      batchStart = separators.lastIndex;
      count = 0;
      if (performance.now() - batchStartedAt >= parseBudgetMs) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        batchStartedAt = performance.now();
      }
    }
    return append(end) ? stations : null;
  } catch {
    // A different valid layout is still supported; malformed input is rejected there.
    return null;
  }
}

/**
 * Find feature boundaries without interpreting JSON values. Strings are consumed as whole
 * tokens, so braces, escaped quotes and a word like "features" inside a name are harmless.
 * JSON.parse still validates every batch and the collection around the feature array.
 */
export async function parseStations(text: string): Promise<Station[]> {
  const generated = await parseGeneratedStations(text);
  if (generated) return generated;

  const tokens = /"(?:[^"\\]|\\.)*"|[{}[\]]/g;
  const arrayStart = /\s*:\s*\[/y;
  const stations: Station[] = [];
  let depth = 0;
  let featuresStart = -1;
  let batchStart = -1;
  let batchEnd = -1;
  let featureCount = 0;
  let checkedTokens = 0;
  let batchStartedAt = performance.now();

  function appendBatch() {
    if (featureCount === 0) return;
    const features = JSON.parse(`[${text.slice(batchStart, batchEnd)}]`) as StationFeature[];
    appendStations(stations, features);
    featureCount = 0;
    batchStart = -1;
  }

  let token: RegExpExecArray | null;
  while ((token = tokens.exec(text)) !== null) {
    const value = token[0];
    if (featuresStart === -1) {
      if (depth === 1 && value.startsWith('"') && JSON.parse(value) === "features") {
        arrayStart.lastIndex = tokens.lastIndex;
        if (arrayStart.exec(text)) {
          featuresStart = arrayStart.lastIndex;
          tokens.lastIndex = featuresStart;
          depth = 2;
          batchEnd = featuresStart;
        }
      } else if (value === "{" || value === "[") {
        depth++;
      } else if (value === "}" || value === "]") {
        depth--;
      }
    } else if (depth === 2) {
      const separator = text.slice(batchEnd, token.index).replace(/[ \t\r\n]/g, "");
      if (value === "]") {
        // No trailing comma, and no values that the boundary scanner skipped.
        if (separator !== "") throw new Error("Stations are invalid.");
        appendBatch();
        const collection = JSON.parse(
          `${text.slice(0, featuresStart)}${text.slice(token.index)}`,
        ) as StationFeatureCollection;
        if (!Array.isArray(collection.features) || collection.features.length !== 0) {
          throw new Error("Stations are invalid.");
        }
        return stations;
      }
      if (value !== "{" || separator !== (batchEnd === featuresStart ? "" : ",")) {
        throw new Error("Stations are invalid.");
      }
      if (batchStart === -1) batchStart = token.index;
      depth++;
    } else if (value === "{" || value === "[") {
      depth++;
    } else if (value === "}" || value === "]") {
      depth--;
      if (depth === 2) {
        batchEnd = tokens.lastIndex;
        featureCount++;
        if (featureCount === maxBatchFeatures) appendBatch();
      }
    }

    // Bound scanning as well as parsing/conversion, including a large individual feature.
    if (
      ++checkedTokens % scanCheckInterval === 0 &&
      performance.now() - batchStartedAt >= parseBudgetMs
    ) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      batchStartedAt = performance.now();
    }
  }
  throw new Error("Stations are invalid.");
}
