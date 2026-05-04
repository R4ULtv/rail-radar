import fs from "node:fs/promises";
import path from "node:path";
import type { Connect, Plugin } from "vite";
import type { StationFeatureCollection } from "@repo/data";
import {
  applyStationUpdates,
  featureToStation,
  geojsonToStations,
  normalizeNewStation,
  stationToFeature,
  validateGeojson,
} from "../src/lib/stations";

const DATA_FILE_PATH = path.resolve(process.cwd(), "../../packages/data/src/stations.geojson");

async function readGeojsonFile(): Promise<StationFeatureCollection> {
  const content = await fs.readFile(DATA_FILE_PATH, "utf-8");
  return validateGeojson(JSON.parse(content));
}

async function writeGeojsonFile(geojson: StationFeatureCollection): Promise<void> {
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

function readBody(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function send(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

export function localStationApi(): Plugin {
  const enabled =
    process.env.PUBLIC_STUDIO_LOCAL_MODE === "true" ||
    process.env.LOCAL_ENV === "true" ||
    process.env.STUDIO_LOCAL_MODE === "true";

  return {
    name: "studio-local-station-api",
    apply: "serve",
    configureServer(server) {
      if (!enabled) return;

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (!url || !url.startsWith("/api/stations")) return next();

        try {
          if (url === "/api/stations" && req.method === "GET") {
            const geojson = await readGeojsonFile();
            return send(res, 200, geojsonToStations(geojson));
          }

          if (url === "/api/stations" && req.method === "POST") {
            const body = await readBody(req);
            const newStation = normalizeNewStation(body as never);
            const geojson = await readGeojsonFile();

            if (geojson.features.some((f) => f.properties.id === newStation.id)) {
              return send(res, 409, { error: `Station ID "${newStation.id}" already exists` });
            }

            geojson.features.push(stationToFeature(newStation));
            await writeGeojsonFile(geojson);
            return send(res, 201, featureToStation(stationToFeature(newStation)));
          }

          if (url === "/api/stations/restore" && req.method === "POST") {
            const station = (await readBody(req)) as {
              id?: string;
              name?: string;
              geo?: unknown;
            };
            if (!station?.id || !station.name || !station.geo) {
              return send(res, 400, { error: "Invalid station payload" });
            }
            const geojson = await readGeojsonFile();
            const feature = stationToFeature(station as never);
            const index = geojson.features.findIndex((item) => item.properties.id === station.id);
            if (index === -1) geojson.features.push(feature);
            else geojson.features[index] = feature;
            await writeGeojsonFile(geojson);
            return send(res, 200, station);
          }

          const idMatch = url.match(/^\/api\/stations\/([^/]+)$/);
          if (idMatch) {
            const id = decodeURIComponent(idMatch[1]!);

            if (req.method === "PUT") {
              const body = await readBody(req);
              const geojson = await readGeojsonFile();
              const index = geojson.features.findIndex((f) => f.properties.id === id);
              const existing = geojson.features[index];
              if (index === -1 || !existing) {
                return send(res, 404, { error: "Station not found" });
              }
              const updated = applyStationUpdates(featureToStation(existing), body as never);
              geojson.features[index] = stationToFeature(updated);
              await writeGeojsonFile(geojson);
              return send(res, 200, updated);
            }

            if (req.method === "DELETE") {
              const geojson = await readGeojsonFile();
              const index = geojson.features.findIndex((f) => f.properties.id === id);
              if (index === -1) return send(res, 404, { error: "Station not found" });
              const deleted = featureToStation(geojson.features[index]!);
              geojson.features.splice(index, 1);
              await writeGeojsonFile(geojson);
              return send(res, 200, deleted);
            }
          }

          return next();
        } catch (error) {
          console.error("[local-station-api]", error);
          return send(res, 500, {
            error: error instanceof Error ? error.message : "Internal error",
          });
        }
      });
    },
  };
}
