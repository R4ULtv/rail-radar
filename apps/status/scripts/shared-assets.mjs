import { readFile } from "node:fs/promises";

const assetRoot = new URL("../../web/public/assets/", import.meta.url);
const assetPath =
  /^\/(?:flags\/[a-z]{2}\.svg|operators\/[a-z0-9/-]+\.svg|providers\/[a-z0-9-]+\.(?:svg|png))$/;

/** Dev-only access to the same canonical files that the main website publishes. */
export function sharedAssets() {
  return {
    name: "rail-radar-shared-assets",
    configureServer(server) {
      server.middlewares.use("/__shared-assets", async (request, response, next) => {
        const pathname = request.url?.split("?")[0] ?? "";
        if (!["GET", "HEAD"].includes(request.method ?? "") || !assetPath.test(pathname))
          return next();
        try {
          const asset = await readFile(new URL(`.${pathname}`, assetRoot));
          response.setHeader(
            "Content-Type",
            pathname.endsWith(".png") ? "image/png" : "image/svg+xml",
          );
          response.setHeader("Cache-Control", "no-store");
          response.end(request.method === "HEAD" ? undefined : asset);
        } catch (error) {
          if (error.code === "ENOENT") next();
          else next(error);
        }
      });
    },
  };
}
