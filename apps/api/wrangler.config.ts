import { defineWranglerConfig } from "wrangler/experimental-config";

export const assetsDirectory = "../../packages/data/src/lines";

export default defineWranglerConfig({
  assetsDirectory,
  minify: true,
});
