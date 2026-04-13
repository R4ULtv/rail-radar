import { factory } from "../lib/env";
import { jsonError } from "../lib/http";

export const rateLimit = factory.createMiddleware(async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const { success } = await c.env.RATE_LIMITER.limit({ key: ip });

  if (!success) {
    return jsonError(c, "Too many requests. Please wait a moment and try again.", 429);
  }

  c.set("clientIp", ip);
  await next();
});
