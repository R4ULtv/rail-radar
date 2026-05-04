import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { localStationApi } from "./vite-plugins/local-station-api";

export default defineConfig({
  plugins: [localStationApi(), tailwindcss(), sveltekit()],
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
