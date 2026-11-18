import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { sharedAssets } from "./scripts/shared-assets.mjs";

export default defineConfig({
  output: "static",
  // Packages the static build for cf (Build Output in .cloudflare/output/v0). The page is
  // fully prerendered, so the adapter's Images and session KV bindings are switched off.
  adapter: cloudflare({ imageService: "passthrough" }),
  session: false,
  integrations: [react()],
  vite: { plugins: [sharedAssets(), tailwindcss()], server: { strictPort: true } },
});
