import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { readFileSync, realpathSync } from "node:fs";
import { localStationApi } from "./vite-plugins/local-station-api.ts";
import { localLineApi } from "./vite-plugins/local-line-api.ts";

export default defineConfig({
  server: {
    fs: { allow: ["../..", realpathSync("../../node_modules")] },
  },
  plugins: [
    {
      name: "studio-geojson",
      enforce: "pre",
      load(id) {
        const filename = id.split("?")[0]!;
        if (!filename.endsWith(".geojson")) return null;
        const json = JSON.stringify(JSON.parse(readFileSync(filename, "utf8")));
        return `export default JSON.parse(${JSON.stringify(json)});`;
      },
    },
    localStationApi(),
    localLineApi(),
    tailwindcss(),
    sveltekit(),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
