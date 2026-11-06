import { ogImageKey, OG_STATION_ID } from "./station-og";

interface OgObjectMetadata {
  httpEtag: string;
  httpMetadata?: { contentType?: string };
  size: number;
}

export interface OgRuntime {
  rateLimiter: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  bucket: {
    get(key: string): Promise<(OgObjectMetadata & { body: ReadableStream }) | null>;
    head(key: string): Promise<OgObjectMetadata | null>;
  };
  openCache?: () => Promise<Pick<Cache, "match" | "put">>;
  waitUntil(promise: Promise<unknown>): void;
}

const CACHE_CONTROL = "public, max-age=86400, s-maxage=86400";
const MISSING_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";
const DEFAULT_IMAGE = "/assets/social/og-image.webp";

function matchesEtag(request: Request, etag: string): boolean {
  return (request.headers.get("If-None-Match") ?? "").split(",").some((value) => {
    const tag = value.trim().replace(/^W\//, "");
    return tag === "*" || tag === etag;
  });
}

/** One stable R2 image per station, cached for one day. No inventory read or rendering. */
export async function getStationOgResponse(
  request: Request,
  runtime: OgRuntime,
): Promise<Response> {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await runtime.rateLimiter.limit({ key: ip });
  if (!success)
    return new Response("Too many requests. Please wait a moment and try again.", {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": "10" },
    });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id || !OG_STATION_ID.test(id))
    return new Response("Invalid station ID", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  url.search = new URLSearchParams({ id }).toString();
  url.hash = "";
  const cacheKey = new Request(url, { method: "GET" });
  let cache: Pick<Cache, "match" | "put"> | undefined;
  try {
    cache = await (runtime.openCache?.() ?? caches.open("station-og-single-v1"));
    const cached = await cache.match(cacheKey);
    if (cached) {
      const etag = cached.headers.get("ETag");
      if (etag && matchesEtag(request, etag))
        return new Response(null, {
          status: 304,
          headers: { ETag: etag, "Cache-Control": CACHE_CONTROL },
        });
      return new Response(request.method === "HEAD" ? null : cached.body, cached);
    }
  } catch {
    cache = undefined;
  }
  const key = ogImageKey(id);
  const fullObject = request.method === "HEAD" ? null : await runtime.bucket.get(key);
  const object = request.method === "HEAD" ? await runtime.bucket.head(key) : fullObject;
  let response: Response;
  if (!object) {
    response = new Response(null, {
      status: 302,
      headers: { Location: DEFAULT_IMAGE, "Cache-Control": MISSING_CACHE_CONTROL },
    });
  } else {
    if (object.httpMetadata?.contentType !== "image/webp")
      return new Response("Image unavailable", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    const headers = {
      "Content-Type": "image/webp",
      "Cache-Control": CACHE_CONTROL,
      ETag: object.httpEtag,
    };
    if (matchesEtag(request, object.httpEtag)) return new Response(null, { status: 304, headers });
    response = new Response(fullObject?.body ?? null, { headers });
  }
  // HEAD has no image body and must not populate a shared GET cache entry.
  if (cache && request.method === "GET")
    runtime.waitUntil(cache.put(cacheKey, response.clone()).catch(() => undefined));
  return response;
}
