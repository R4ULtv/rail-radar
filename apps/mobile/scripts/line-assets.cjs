// Builds the line files the app bundles, so lines work offline. metro.config.js runs it whenever
// Metro starts:
// - lines.geojson: one FeatureCollection with every line's track, which the map draws from.
// - line-operators.json: the names of the lines' operators, without the rest of operators.json.
//
// The tracks are simplified to within 2 m and rounded to 5 decimals (about 1 m), which looks
// the same at street zoom and makes the file less than half the size of the source tracks.

const fs = require("node:fs");
const path = require("node:path");

const TOLERANCE_M = 2;
const EARTH_RADIUS_M = 6_371_000;
const DEFAULT_LINE_COLOR = "#8E8E93";

/** Ramer–Douglas–Peucker on an equirectangular projection, accurate enough at city scale. */
function simplify(points, toleranceM) {
  if (points.length < 3) return points;
  const lat = (points[0][1] * Math.PI) / 180;
  const kx = (Math.cos(lat) * Math.PI * EARTH_RADIUS_M) / 180;
  const ky = (Math.PI * EARTH_RADIUS_M) / 180;
  const xy = points.map(([lng, lat]) => [lng * kx, lat * ky]);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const tolerance2 = toleranceM * toleranceM;

  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = xy[first];
    const [bx, by] = xy[last];
    const dx = bx - ax;
    const dy = by - ay;
    const length2 = dx * dx + dy * dy;
    let farthest = -1;
    let max = tolerance2;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = xy[i];
      const t = length2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2)) : 0;
      const ex = px - (ax + t * dx);
      const ey = py - (ay + t * dy);
      const distance2 = ex * ex + ey * ey;
      if (distance2 > max) {
        max = distance2;
        farthest = i;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = (value) => Math.round(value * 1e5) / 1e5;

/** Joins pieces that carry on from where the previous one ended, so they simplify as one. */
function joinPieces(pieces) {
  const joined = [];
  for (const piece of pieces) {
    const previous = joined.at(-1);
    const end = previous?.at(-1);
    if (end && end[0] === piece[0][0] && end[1] === piece[0][1]) previous.push(...piece.slice(1));
    else joined.push([...piece]);
  }
  return joined;
}

function buildLineTracks(lines) {
  const tracksDir = path.dirname(require.resolve("@repo/data/lines/" + lines[0].id + ".json"));
  const features = [];
  for (const line of lines) {
    const file = path.join(tracksDir, `${line.id}.json`);
    if (!fs.existsSync(file)) continue;
    const geometry = JSON.parse(fs.readFileSync(file, "utf8"));
    const coordinates = joinPieces(geometry.coordinates)
      .map((piece) => simplify(piece, TOLERANCE_M).map(([lng, lat]) => [round(lng), round(lat)]))
      .filter((piece) => piece.length > 1);
    if (coordinates.length === 0) continue;
    features.push({
      type: "Feature",
      properties: { id: line.id, color: line.color ?? DEFAULT_LINE_COLOR },
      geometry: { type: "MultiLineString", coordinates },
    });
  }
  return JSON.stringify({ type: "FeatureCollection", features });
}

function buildLineOperators(lines) {
  // operators.json isn't one of @repo/data's exports, but sits next to lines.json.
  const source = path.join(
    path.dirname(require.resolve("@repo/data/lines.json")),
    "operators.json",
  );
  const operators = JSON.parse(fs.readFileSync(source, "utf8"));
  const names = new Map(operators.map((operator) => [operator.slug, operator.name]));
  const used = {};
  for (const line of lines) {
    if (line.operator && names.has(line.operator)) used[line.operator] = names.get(line.operator);
  }
  return JSON.stringify(used);
}

/** Only written when it changed, so Metro doesn't reload. */
function writeIfChanged(destination, content) {
  if (fs.existsSync(destination) && fs.readFileSync(destination, "utf8") === content) return;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

/** Writes the line files into `directory`. */
function writeLineAssets(directory) {
  const lines = JSON.parse(fs.readFileSync(require.resolve("@repo/data/lines.json"), "utf8"));
  writeIfChanged(path.join(directory, "lines.geojson"), buildLineTracks(lines));
  writeIfChanged(path.join(directory, "line-operators.json"), buildLineOperators(lines));
}

module.exports = { writeLineAssets };
