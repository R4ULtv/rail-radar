import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { COUNTRY_SLUGS } from "../../packages/data/src/countries.ts";
import { isStationPagePrerendered } from "./src/lib/station-prerender.ts";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

type OperatorRecord = { slug: string };
type StationFeatureRecord = {
  properties: { id: string; importance: 1 | 2 | 3 | 4; type: "rail" | "metro" | "light" };
};

const operatorRecords = JSON.parse(
  readFileSync(new URL("../../packages/data/src/operators.json", import.meta.url), "utf8"),
) as OperatorRecord[];

const stationRecords = JSON.parse(
  readFileSync(new URL("../../packages/data/src/stations.geojson", import.meta.url), "utf8"),
) as { features: StationFeatureRecord[] };

const prerenderPages = [
  "/",
  "/donate",
  "/operators",
  "/privacy-policy",
  "/sitemap.xml",
  "/stations",
  "/terms-of-service",
  "/report/2026-04-28",
  "/report/2026-07-24",
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
