import { factory } from "../lib/env";
import { jsonError } from "../lib/http";

function tooManyRequests(c: Parameters<typeof jsonError>[0], retryAfterSeconds: number) {
  // The binding does not expose a reset time; wait a full window before retrying.
  c.header("Retry-After", String(retryAfterSeconds));
  c.header("Cache-Control", "no-store");
  return jsonError(c, "Too many requests. Please wait a moment and try again.", 429);
}

export const rateLimit = factory.createMiddleware(
  async (c, next): Promise<ReturnType<typeof jsonError> | void> => {
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const { success } = await c.env.RATE_LIMITER.limit({ key: ip });

    if (!success) {
      return tooManyRequests(c, 10);
    }

    c.set("clientIp", ip);
    await next();
  },
);

export const stationRateLimit = factory.createMiddleware(
  async (c, next): Promise<ReturnType<typeof jsonError> | void> => {
    // All station IDs, board types and query strings share one budget per IP.
    // Prefix the key to separate this budget from other rate-limiter bindings.
    const key = `station-boards:${c.get("clientIp")}`;
    const { success } = await c.env.STATION_RATE_LIMITER.limit({ key });

    if (!success) {
      return tooManyRequests(c, 60);
    }

    await next();
  },
);
