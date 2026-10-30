import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import type { StationFeatureCollection } from "../../packages/data/src/types.ts";
import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { COUNTRY_SLUGS } from "../../packages/data/src/countries.ts";
import { isStationPagePrerendered } from "./src/lib/station-prerender.ts";
import { simplify } from "./src/lib/map-projection.ts";
import { publishedReports } from "./src/lib/reports.ts";
import { generateNearbyStationIds } from "./vite/nearby-stations.ts";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

type OperatorRecord = { slug: string };
type LineRecord = { id: string };

const operatorRecords = JSON.parse(
  readFileSync(new URL("../../packages/data/src/operators.json", import.meta.url), "utf8"),
) as OperatorRecord[];

const lineRecords = JSON.parse(
  readFileSync(new URL("../../packages/data/src/lines.json", import.meta.url), "utf8"),
) as LineRecord[];

const stationRecords = JSON.parse(
  readFileSync(new URL("../../packages/data/src/stations.geojson", import.meta.url), "utf8"),
) as StationFeatureCollection;

const prerenderPages = [
  "/",
  "/app",
  "/donate",
  "/lines",
  "/operators",
  "/privacy-policy",
  "/sitemap.xml",
  "/stations",
  "/terms-of-service",
  "/reports",
  ...publishedReports.map((report) => report.path),
  ...lineRecords.map(({ id }) => `/lines/${id}`),
  ...operatorRecords.map(({ slug }) => `/operators/${slug}`),
  ...COUNTRY_SLUGS.map((slug) => `/stations/${slug}`),
  ...stationRecords.features
    .filter(({ properties }) => isStationPagePrerendered(properties))
    .map(({ properties }) => `/station/${properties.id}`),
].map((path) => ({ path }));

const geojsonPlugin: Plugin = {
  name: "rail-radar-geojson",
  enforce: "pre",
  load(id) {
    const filename = id.split("?", 1)[0]!;
    if (!filename.endsWith(".geojson")) return null;
    // Emit `JSON.parse("...")` rather than a bare object literal. V8 parses a JSON
    // string roughly twice as fast as the equivalent JS source, and stations.geojson
    // is ~6 MB, so this is the single largest contributor to isolate startup CPU.
    // Minifying first also drops ~2 MB of the source file's indentation.
    const data = JSON.stringify(JSON.parse(readFileSync(filename, "utf8")));
    return `export default JSON.parse(${JSON.stringify(data)});`;
  },
};

const nearbyStationsPlugin: Plugin = {
  name: "rail-radar-nearby-stations",
  resolveId(id) {
    if (id === "virtual:nearby-stations") return "\0virtual:nearby-stations";
  },
  load(id) {
    if (id !== "\0virtual:nearby-stations") return;
    const filename = new URL("../../packages/data/src/stations.geojson", import.meta.url);
    this.addWatchFile(filename.pathname);
    const catalog = JSON.parse(readFileSync(filename, "utf8")) as StationFeatureCollection;
    const stations = catalog.features.map(({ properties, geometry }) => ({
      ...properties,
      geo: { lat: geometry.coordinates[1]!, lng: geometry.coordinates[0]! },
    }));
    // Generate only IDs, so the Worker keeps using the shared station records and
    // computes just four distances. No station scan or spatial index runs on requests.
    const data = JSON.stringify(generateNearbyStationIds(stations));
    return `export default JSON.parse(${JSON.stringify(data)});`;
  },
};

/** Meters a simplified track may stray from the surveyed one. */
const LINE_TRACK_TOLERANCE = 1;
const METERS_PER_DEGREE = 111_320;

/**
 * Line pages draw each track as an 800×600 picture, and the smallest line (Genova
 * Granarolo, under 1 km) still spans ~1.8 m per pixel. Tracks are surveyed far denser
 * than that, so the Worker gets them simplified to within 1 m — under the 0.6 px the
 * page simplifies to anyway — at well under half their size. The data files keep full
 * detail for the API and Studio.
 */
const lineTrackPlugin: Plugin = {
  name: "rail-radar-line-tracks",
  enforce: "pre",
  load(id) {
    const filename = id.split("?", 1)[0]!;
    if (!/\/packages\/data\/src\/lines\/[^/]+\.json$/.test(filename)) return null;
    const geometry = JSON.parse(readFileSync(filename, "utf8")) as {
      coordinates: [number, number][][];
    };
    const latitude = geometry.coordinates[0]?.[0]?.[1] ?? 0;
    const metersPerLng = Math.cos((latitude * Math.PI) / 180) * METERS_PER_DEGREE;
    for (const [index, part] of geometry.coordinates.entries()) {
      const meters = part.map(([lng, lat], i) => [lng * metersPerLng, lat * METERS_PER_DEGREE, i]);
      geometry.coordinates[index] = simplify(meters, LINE_TRACK_TOLERANCE).map(
        ([, , i]) => part[i!]!,
      );
    }
    return JSON.stringify(geometry);
  },
};

export default defineConfig(({ command, mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), "");
  if (serverEnv.MAPBOX_SERVER_TOKEN) {
    process.env.MAPBOX_SERVER_TOKEN = serverEnv.MAPBOX_SERVER_TOKEN;
  }

  return {
    build: {
      // Mapbox's supported ESM core is a single module just over Vite's default limit.
      // Keep a narrow ceiling above it so unexpected bundle growth still emits a warning.
      chunkSizeWarningLimit: 850,
    },
    server: {
      port: 3000,
    },
    envPrefix: "VITE_",
    resolve: {
      alias: [{ find: /^mapbox-gl$/, replacement: "mapbox-gl/esm" }],
      tsconfigPaths: true,
    },
    plugins: [
      cloudflare({
        viteEnvironment: { name: "ssr" },
        config: (config) => {
          config.r2_buckets?.forEach((bucket) => {
            // Development can show the real station photos. Production builds use local R2 so
            // prerendering never creates a remote connection or reads a manifest.
            bucket.remote = command === "serve";
          });
        },
      }),
      geojsonPlugin,
      nearbyStationsPlugin,
      lineTrackPlugin,
      tailwindcss(),
      tanstackStart({
        pages: prerenderPages,
        prerender: {
          enabled: true,
          // Emit `/page.html` instead of `/page/index.html` so Cloudflare keeps
          // the canonical public URL slashless (`/page`, not `/page/`).
          autoSubfolderIndex: false,
          autoStaticPathsDiscovery: false,
          crawlLinks: false,
          concurrency: 2,
          failOnError: true,
        },
      }),
      viteReact(),
    ],
  };
});
