import { cache } from "hono/cache";
import { factory } from "../lib/env";
import { logRequestError } from "../lib/error-logging";
import { jsonError } from "../lib/http";
import { rateLimit } from "../middleware/rate-limit";
import { getProviderLatency, getProviderSummary } from "../provider-status";

export const statusRoutes = factory
  .createApp()
  .get(
    "/summary",
    rateLimit,
    cache({ cacheName: "provider-summary", cacheControl: "public, max-age=60" }),
    async (c) => {
      try {
        return c.json(
          await getProviderSummary(c.env.CLOUDFLARE_ACCOUNT_ID, c.env.CLOUDFLARE_API_TOKEN),
        );
      } catch (error) {
        logRequestError(c, error, "Provider status summary query failed");
        c.header("Cache-Control", "no-store");
        return jsonError(
          c,
          "Provider status is temporarily unavailable. Please try again later.",
          503,
        );
      }
    },
  )
  .get(
    "/latency",
    rateLimit,
    cache({ cacheName: "provider-latency", cacheControl: "public, max-age=300" }),
    async (c) => {
      try {
        return c.json(
          await getProviderLatency(c.env.CLOUDFLARE_ACCOUNT_ID, c.env.CLOUDFLARE_API_TOKEN),
        );
      } catch (error) {
        logRequestError(c, error, "Provider latency query failed");
        c.header("Cache-Control", "no-store");
        return jsonError(
          c,
          "Provider history is temporarily unavailable. Please try again later.",
          503,
        );
      }
    },
  );
