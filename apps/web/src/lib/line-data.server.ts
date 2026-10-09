import "@tanstack/react-start/server-only";

import { COUNTRY_CODES, type CountryCode } from "@repo/data/countries";
import { getLineStationIds, getStationLines, lineById, lines } from "@repo/data/lines";
import { operatorBySlug } from "@repo/data/operators";
import { stationById } from "@repo/data/stations";
import type { Line, LineGeometry } from "@repo/data";
import type { Metadata } from "@/lib/metadata";
import { getLineColor } from "@/lib/line-colors";
import { createBoundsProjection, simplify, type Bounds } from "@/lib/map-projection";
import { isStationPagePrerendered } from "@/lib/station-prerender";

/** One track file per line, loaded only when that line's page is rendered. */
const geometryFiles = import.meta.glob<LineGeometry>("../../../../packages/data/src/lines/*.json", {
  import: "default",
});

async function loadGeometry(id: string): Promise<LineGeometry | null> {
  const load = geometryFiles[`../../../../packages/data/src/lines/${id}.json`];
  return load ? load() : null;
}

/**
 * What the directory renders per line. Station names come from the 6 MB station
 * registry, so the page gets only the termini rather than the registry itself.
 */
export type DirectoryLine = {
  id: string;
  code: string | null;
  routeCodes: string[];
  name: string;
  type: Line["type"];
  color: string;
  country: CountryCode;
  operator: { slug: string; name: string; logoPath: string } | null;
  from: string;
  to: string;
  loop: boolean;
  branches: number;
  stations: number;
};

/** "Battistini (Roma)" reads as "Battistini" next to a line that already says where it runs. */
function displayName(stationId: string | undefined): string {
  const name = (stationId && stationById.get(stationId)?.name) || "";
  return name.replace(/\s+\([^)]*\)$/, "");
}

function lineCountry(line: Line): CountryCode {
  const prefix = line.id.split("-")[0] as CountryCode;
  if (!COUNTRY_CODES.includes(prefix)) throw new Error(`Line ${line.id} has no known country`);
  return prefix;
}

function toDirectoryLine(line: Line): DirectoryLine {
  const route = line.routes[0]!.stations;
  const operator = line.operator ? operatorBySlug.get(line.operator) : undefined;
  return {
    id: line.id,
    code: line.code,
    routeCodes: [...new Set(line.routes.flatMap((route) => (route.code ? [route.code] : [])))],
    name: line.name,
    type: line.type,
    color: getLineColor(line),
    country: lineCountry(line),
    operator: operator
      ? { slug: operator.slug, name: operator.name, logoPath: operator.logoPath }
      : null,
    from: displayName(route[0]),
    to: displayName(route.at(-1)),
    loop: route[0] === route.at(-1),
    branches: line.routes.length,
    stations: getLineStationIds(line).length,
  };
}

export function getLinesDirectoryPageData() {
  const directory = lines.map(toDirectoryLine);
  const countries = new Set(directory.map((line) => line.country)).size;

  // Lines of one network share stations (five Circumvesuviana lines start at Napoli
  // Porta Nolana), so a network's total counts each station once, per mode filter.
  const networkStations: Record<string, Record<"all" | Line["type"], number>> = {};
  const networkStationIds = new Map<string, Record<"all" | Line["type"], Set<string>>>();
  for (const line of lines) {
    const key = line.operator ?? line.id;
    let sets = networkStationIds.get(key);
    if (!sets) {
      sets = { all: new Set(), metro: new Set(), light: new Set() };
      networkStationIds.set(key, sets);
    }
    for (const id of getLineStationIds(line)) {
      sets.all.add(id);
      sets[line.type].add(id);
    }
  }
  for (const [key, sets] of networkStationIds) {
    networkStations[key] = { all: sets.all.size, metro: sets.metro.size, light: sets.light.size };
  }

  return {
    lines: directory,
    networkStations,
    metadata: {
      title: "Metro & Light Rail Lines",
      description: `Browse ${directory.length} metro and light rail lines across ${countries} countries on Rail Radar, with their stations, termini, and operators.`,
      alternates: {
        canonical: "/lines",
      },
    } satisfies Metadata,
  };
}

/** Size of the `/map/static?bbox=…&w=800&h=600` image behind the line. */
const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
/** Room between the track and the image edge, in px. */
const MAP_PADDING = 24;
/** The API always pads the bbox it's given by 40px (apps/api/src/routes/map.ts). */
const API_PADDING = 40;
/** Extra room around the track, as a share of its extent, so termini aren't at the edge. */
const MAP_MARGIN = 0.04;

/** How far past the image edge a track is still drawn, so lines leave the frame cleanly. */
const MAP_CLIP_MARGIN = 40;

/**
 * SVG path data for a track: simplified to what the image can show and, when `clip` is
 * set, cut to the frame so a long connecting line doesn't ship points nobody sees.
 */
function trackPaths(
  geometry: LineGeometry,
  project: (position: readonly number[]) => [number, number],
  clip: boolean,
): string[] {
  const inFrame = ([x, y]: [number, number]) =>
    x >= -MAP_CLIP_MARGIN &&
    x <= MAP_WIDTH + MAP_CLIP_MARGIN &&
    y >= -MAP_CLIP_MARGIN &&
    y <= MAP_HEIGHT + MAP_CLIP_MARGIN;
  const paths: string[] = [];
  for (const part of geometry.coordinates) {
    const points = part.map(project);
    let run: [number, number][] = [];
    const flush = () => {
      if (run.length > 1) {
        paths.push(
          "M" +
            simplify(run, 0.6)
              .map(([x, y]) => `${round(x, 1)} ${round(y, 1)}`)
              .join("L"),
        );
      }
      run = [];
    };
    points.forEach((point, i) => {
      // Keep the first point outside the frame on each side, so the line reaches the edge.
      const visible =
        !clip ||
        inFrame(point) ||
        (i > 0 && inFrame(points[i - 1]!)) ||
        (i < points.length - 1 && inFrame(points[i + 1]!));
      if (visible) run.push(point);
      else flush();
    });
    flush();
  }
  return paths;
}

function geometryBounds(geometry: LineGeometry): Bounds {
  const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const part of geometry.coordinates) {
    for (const [lng, lat] of part) {
      bounds[0] = Math.min(bounds[0], lng!);
      bounds[1] = Math.min(bounds[1], lat!);
      bounds[2] = Math.max(bounds[2], lng!);
      bounds[3] = Math.max(bounds[3], lat!);
    }
  }
  return bounds;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export async function getLinePageData(id: string) {
  const line = lineById.get(id);
  if (!line) return null;

  const summary = toDirectoryLine(line);
  const stationIds = getLineStationIds(line);
  const stations = Object.fromEntries(
    stationIds.map((stationId) => {
      const station = stationById.get(stationId)!;
      return [
        stationId,
        {
          id: stationId,
          name: displayName(stationId),
          rail: station.type === "rail",
          prerendered: isStationPagePrerendered(station) || undefined,
          interchanges: getStationLines(stationId)
            .filter((other) => other.id !== line.id)
            .map((other) => ({
              id: other.id,
              code: other.code,
              name: other.name,
              type: other.type,
              color: getLineColor(other),
            })),
        },
      ];
    }),
  );

  const connectingLines = lines.filter(
    (other) =>
      other.id !== line.id &&
      stationIds.some((stationId) => getStationLines(stationId).includes(other)),
  );
  const geometry = await loadGeometry(line.id);
  let map = null;
  if (geometry) {
    const [west, south, east, north] = geometryBounds(geometry);
    const marginX = (east - west) * MAP_MARGIN;
    const marginY = (north - south) * MAP_MARGIN;
    const bounds: Bounds = [west - marginX, south - marginY, east + marginX, north + marginY];
    const { project, unproject, zoom } = createBoundsProjection(
      bounds,
      MAP_WIDTH,
      MAP_HEIGHT,
      MAP_PADDING,
    );
    // The bbox that, padded by the API's 40px, shows exactly this view.
    const [requestWest, requestNorth] = unproject([API_PADDING, API_PADDING]);
    const [requestEast, requestSouth] = unproject([
      MAP_WIDTH - API_PADDING,
      MAP_HEIGHT - API_PADDING,
    ]);
    map = {
      bounds: [requestWest, requestSouth, requestEast, requestNorth].map((value) =>
        round(value, 5),
      ),
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      paths: trackPaths(geometry, project, false),
      // Lines sharing a stop with this one, drawn faintly underneath it.
      connections: (
        await Promise.all(
          connectingLines.map(async (other) => {
            const otherGeometry = await loadGeometry(other.id);
            return {
              id: other.id,
              color: getLineColor(other),
              paths: otherGeometry ? trackPaths(otherGeometry, project, true) : [],
            };
          }),
        )
      ).filter((connection) => connection.paths.length > 0),
      stops: stationIds.flatMap((stationId) => {
        const geo = stationById.get(stationId)?.geo;
        if (!geo) return [];
        const [x, y] = project([geo.lng, geo.lat]);
        return [{ id: stationId, x: round(x, 1), y: round(y, 1) }];
      }),
      view: {
        lat: round((bounds[1] + bounds[3]) / 2, 4),
        lng: round((bounds[0] + bounds[2]) / 2, 4),
        zoom: Math.max(Math.floor(zoom), 3),
      },
    };
  }

  const network = line.operator
    ? lines
        .filter((other) => other.operator === line.operator && other.id !== line.id)
        .map(toDirectoryLine)
    : [];
  const modeLabel = line.type === "metro" ? "Metro" : "Light Rail";
  const between = summary.loop
    ? `on a loop through ${summary.from}`
    : `between ${summary.from} and ${summary.to}`;

  return {
    line: summary,
    description: line.description ?? null,
    routes: line.routes.map((route) => ({
      code: route.code ?? null,
      from: displayName(route.stations[0]),
      to: displayName(route.stations.at(-1)),
      stations: route.stations,
    })),
    stations,
    network,
    map,
    metadata: {
      title: `${line.name} - ${modeLabel} Line${summary.operator ? ` | ${summary.operator.name}` : ""}`,
      description:
        line.description ??
        `${line.name} is a ${modeLabel.toLowerCase()} line${summary.operator ? ` run by ${summary.operator.name}` : ""} ${between}, with ${stationIds.length} stations. See every stop and interchange on Rail Radar.`,
      alternates: {
        canonical: `/lines/${line.id}`,
      },
    } satisfies Metadata,
  };
}

export type LinePageData = NonNullable<Awaited<ReturnType<typeof getLinePageData>>>;
