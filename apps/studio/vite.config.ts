import tailwindcss from "@tailwindcss/vite";
import { cloudflareStaticAdapter } from "./vite-plugins/cloudflare-static-adapter.ts";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { readFileSync, realpathSync } from "node:fs";
import { localStationApi } from "./vite-plugins/local-station-api.ts";
import { localLineApi } from "./vite-plugins/local-line-api.ts";
import { localOperatorApi } from "./vite-plugins/local-operator-api.ts";

export default defineConfig(({ mode }) => ({
  server: {
    port: 3001,
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
    localOperatorApi(),
    tailwindcss(),
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: cloudflareStaticAdapter(mode),
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
  },
}));
