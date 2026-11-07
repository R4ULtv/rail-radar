import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { sharedAssets } from "./scripts/shared-assets.mjs";

export default defineConfig({
  output: "static",
  integrations: [react()],
  vite: { plugins: [sharedAssets(), tailwindcss()], server: { strictPort: true } },
});
