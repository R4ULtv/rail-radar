import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import { readFileSync } from "node:fs";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

type OperatorRecord = { slug: string };
type StationFeatureRecord = {
  properties: { id: string; importance: number; type: "rail" | "metro" | "light" };
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
  "/terms-of-service",
  "/report/2026-04-28",
  "/report/2026-07-24",
  ...operatorRecords.map(({ slug }) => `/operators/${slug}`),
  ...stationRecords.features
    .filter(({ properties }) => properties.type === "rail" && properties.importance <= 3)
    .map(({ properties }) => `/station/${properties.id}`),
].map((path) => ({ path }));

const geojsonPlugin: Plugin = {
  name: "rail-radar-geojson",
  enforce: "pre",
  load(id) {
    const filename = id.split("?", 1)[0]!;
    if (!filename.endsWith(".geojson")) return null;
    return `export default ${readFileSync(filename, "utf8")}`;
  },
};

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), "");
  if (serverEnv.MAPBOX_SERVER_TOKEN) {
    process.env.MAPBOX_SERVER_TOKEN = serverEnv.MAPBOX_SERVER_TOKEN;
  }

  return {
    server: {
      port: 3000,
    },
    envPrefix: "VITE_",
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      geojsonPlugin,
      tailwindcss(),
      tanstackStart({
        pages: prerenderPages,
        prerender: {
          enabled: true,
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
