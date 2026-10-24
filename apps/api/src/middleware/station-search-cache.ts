import { CACHE_TTL } from "../constants";
import { factory } from "../lib/env";
import { logRequestWarning } from "../lib/error-logging";

const CACHE_NAME = "search-cache";

/** Search uses local data, so cache outages must not prevent fresh results. */
export const stationSearchCache = factory.createMiddleware(async (c, next) => {
  if (
    c.req.method !== "GET" ||
    c.req.raw.headers.has("Authorization") ||
    typeof caches === "undefined"
  ) {
    await next();
    return;
  }

  let cache: Cache | undefined;
  try {
    cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(c.req.url);
    if (cached) return new Response(cached.body, cached);
  } catch (cause) {
    const message = "Station search cache lookup failed. Serving fresh search results.";
    logRequestWarning(c, new Error(message, { cause }), message, {
      cacheName: CACHE_NAME,
      cacheOperation: "lookup",
      status: null,
    });
  }

  await next();

  if (c.res.status !== 200) return;
  const cacheControl = c.res.headers.get("Cache-Control");
  if (
    c.res.headers.has("Set-Cookie") ||
    /(?:^|,)\s*(?:private|no-store|no-cache)\b/i.test(cacheControl ?? "") ||
    c.res.headers
      .get("Vary")
      ?.split(",")
      .some((value) => value.trim() === "*")
  ) {
    return;
  }

  if (!cacheControl) c.header("Cache-Control", CACHE_TTL.SEARCH);
  if (!cache) return;

  const response = c.res.clone();
  const searchCache = cache;
  c.executionCtx.waitUntil(
    (async () => {
      try {
        await searchCache.put(c.req.url, response);
      } catch (cause) {
        const message = "Station search cache write failed. Search results were still served.";
        logRequestWarning(c, new Error(message, { cause }), message, {
          cacheName: CACHE_NAME,
          cacheOperation: "put",
          status: 200,
        });
      }
    })(),
  );
});
