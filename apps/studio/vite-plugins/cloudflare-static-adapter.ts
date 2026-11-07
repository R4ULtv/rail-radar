import adapter from "@sveltejs/adapter-static";
import type { Adapter } from "@sveltejs/kit";
import { loadAndParseConfig } from "@cloudflare/config";
import {
  cleanBuildOutputDir,
  writeAssets,
  writeRootConfig,
  writeWorkerConfig,
} from "@cloudflare/build-output-utils";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/** Keep SvelteKit's static output and package it for cf without adding a server Worker. */
export function cloudflareStaticAdapter(mode: string): Adapter {
  const staticAdapter = adapter({ pages: "build", assets: "build" });
  return {
    ...staticAdapter,
    name: "rail-radar-cloudflare-static",
    async adapt(builder) {
      await staticAdapter.adapt(builder);
      const root = fileURLToPath(new URL("../", import.meta.url));
      const context = {
        mode,
        // Set by cf previews deploy when it invokes the framework build.
        // oxlint-disable-next-line turbo/no-undeclared-env-vars -- Set by cf, not a build input.
        isPreview: process.env.CLOUDFLARE_PREVIEW_BUILD === "true",
      };
      const { result } = await loadAndParseConfig(join(root, "cloudflare.config.ts"), context);
      if (!result.success) throw new Error("Invalid Cloudflare config", { cause: result.error });
      if (!result.data.worker) throw new Error("Studio's Cloudflare config must define a Worker");
      await cleanBuildOutputDir(root);
      await writeAssets({ root, sourceDirectory: join(root, "build") });
      await writeWorkerConfig({ root, config: result.data.worker });
      await writeRootConfig(
        root,
        { accountId: result.data.accountId, complianceRegion: result.data.complianceRegion },
        context,
      );
    },
  };
}
