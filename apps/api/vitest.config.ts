import { readFileSync } from "node:fs";
import { assetsDirectory } from "./wrangler.config.ts";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig, type Plugin } from "vitest/config";

/** Wrangler bundles `.geojson` imports as JSON; Vite needs to be told to do the same. */
const geojson: Plugin = {
  name: "api-test-geojson",
  enforce: "pre",
  load(id) {
    const filename = id.split("?")[0]!;
    if (!filename.endsWith(".geojson")) return null;
    // A string parsed at runtime transforms far faster than a 6 MB object literal.
    const json = JSON.stringify(JSON.parse(readFileSync(filename, "utf8")));
    // An empty map stops Vite inlining a source map that would embed the whole file again.
    return { code: `export default JSON.parse(${JSON.stringify(json)});`, map: { mappings: "" } };
  },
};

export default defineConfig({
  plugins: [
    geojson,
    // Run every test inside workerd with the bindings declared in cloudflare.config.ts.
    cloudflareTest({
      config: "./cloudflare.config.ts",
      // The cf config declares ASSETS; the bundler config supplies its files.
      miniflare: { assets: { directory: assetsDirectory, binding: "ASSETS" } },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
    // Reuse each workerd runtime across files instead of starting one per file (~40% faster).
    // Tests must not depend on module state from other files; check with
    // `vitest run --sequence.shuffle.files --maxWorkers=1`.
    isolate: false,
    // Gives each test a fresh, isolated view of the runtime's Cache API.
    setupFiles: ["./tests/helpers/cache-storage.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});
