import type { Context } from "hono";
import { cache } from "hono/cache";
import { factory } from "../lib/env";
import { logRequestError } from "../lib/error-logging";
import { jsonError } from "../lib/http";
import { rateLimit } from "../middleware/rate-limit";
import { getProviderLatency, getProviderSummary } from "../provider-status";

// Each cache miss costs Analytics Engine read queries (1 for the summary, 2 for history),
// which are metered per account across the whole API.
const SUMMARY_CACHE_SECONDS = 60;
// History is daily buckets, so only today's partial day changes between reads.
const LATENCY_CACHE_SECONDS = 900;
// After a failed read, answer from the edge for a while instead of retrying upstream.
const FAILURE_COOLDOWN_SECONDS = 30;

// Query strings are ignored, so `?anything` can't bypass the cache to force a new query.
const pathOnly = (c: Context) => {
  const url = new URL(c.req.url);
  return `${url.origin}${url.pathname}`;
};

const cooldownKey = (c: Context) => `${pathOnly(c)}/__cooldown`;

/** Runs an Analytics Engine read, or a 503 while a recent failure is still cooling down. */
async function readStatus<T>(
  c: Context,
  load: () => Promise<T>,
  logMessage: string,
  userMessage: string,
) {
  const unavailable = () => {
    c.header("Cache-Control", "no-store");
    return jsonError(c, userMessage, 503);
  };
  let cooldown: Cache | undefined;
  try {
    cooldown = await caches.open("status-cooldown-v1");
    if (await cooldown.match(cooldownKey(c))) return unavailable();
  } catch {
    // Cache availability must not make the status routes fail.
  }
  try {
    return c.json(await load());
  } catch (error) {
    logRequestError(c, error, logMessage);
    try {
      await cooldown?.put(
        cooldownKey(c),
        new Response(null, {
          headers: { "Cache-Control": `public, max-age=${FAILURE_COOLDOWN_SECONDS}` },
        }),
      );
    } catch {
      // Without the marker the next request simply retries upstream.
    }
    return unavailable();
  }
}

export const statusRoutes = factory
  .createApp()
  .get(
    "/summary",
    rateLimit,
    cache({
      cacheName: "status-summary-v4",
      cacheControl: `public, max-age=${SUMMARY_CACHE_SECONDS}`,
      keyGenerator: pathOnly,
    }),
    (c) =>
      readStatus(
        c,
        () =>
          getProviderSummary(c.env.CLOUDFLARE_ACCOUNT_ID, c.env.CLOUDFLARE_API_TOKEN, new Date()),
        "Provider status summary query failed",
        "Provider status is temporarily unavailable. Please try again later.",
      ),
  )
  .get(
    "/latency",
    rateLimit,
    cache({
      cacheName: "status-latency-v3",
      cacheControl: `public, max-age=${LATENCY_CACHE_SECONDS}`,
      keyGenerator: pathOnly,
    }),
    (c) =>
      readStatus(
        c,
        () =>
          getProviderLatency(c.env.CLOUDFLARE_ACCOUNT_ID, c.env.CLOUDFLARE_API_TOKEN, new Date()),
        "Provider latency query failed",
        "Provider history is temporarily unavailable. Please try again later.",
      ),
  );
