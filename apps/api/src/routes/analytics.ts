import { cache } from "hono/cache";

import { getAnalyticsOverview } from "../analytics";
import { CACHE_TTL } from "../constants";
import { factory } from "../lib/env";
import { jsonError } from "../lib/http";
import { rateLimit } from "../middleware/rate-limit";

export const analyticsRoutes = factory.createApp().get(
  "/overview",
  rateLimit,
  cache({
    cacheName: "analytics-cache",
    cacheControl: CACHE_TTL.ANALYTICS,
  }),
  async (c) => {
    try {
      const overview = await getAnalyticsOverview(
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_API_TOKEN,
      );

      return c.json({
        timestamp: new Date().toISOString(),
        ...overview,
      });
    } catch {
      return jsonError(c, "Unable to fetch analytics data. Please try again later.", 500);
    }
  },
);
