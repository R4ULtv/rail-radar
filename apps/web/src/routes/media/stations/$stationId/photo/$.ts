import { env, waitUntil } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import {
  SAFE_KEY_SEGMENT,
  canonicalMediaCacheKey,
  getStationPhotoManifest,
  isSafeRelativeKey,
} from "@/lib/station-photo-manifest.server";

const IMAGE_CACHE = "public, max-age=31536000, immutable";
const IMAGE_CONTENT_TYPES = {
  avif: "image/avif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export const Route = createFileRoute("/media/stations/$stationId/photo/$")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        getStationPhotoResponse(request, params.stationId, params._splat ?? ""),
      HEAD: ({ request, params }) =>
        getStationPhotoResponse(request, params.stationId, params._splat ?? ""),
      ANY: () => methodNotAllowed(),
    },
  },
});

function methodNotAllowed(): Response {
  return new Response("Method not allowed", {
    status: 405,
    headers: { Allow: "GET, HEAD" },
  });
}

function contentTypeForKey(key: string): string | null {
  const extension = key.split(".").pop()?.toLowerCase();
  return extension && extension in IMAGE_CONTENT_TYPES
    ? IMAGE_CONTENT_TYPES[extension as keyof typeof IMAGE_CONTENT_TYPES]
    : null;
}

function normalizeImageContentType(value: string | undefined): string | null {
  const contentType = value?.split(";", 1)[0]?.trim().toLowerCase();
  return contentType && Object.values(IMAGE_CONTENT_TYPES).includes(contentType as never)
    ? contentType
    : null;
}

function internalError(request: Request, error: unknown): Response {
  console.error(
    JSON.stringify({
      message: "Station photo request failed",
      path: new URL(request.url).pathname,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return new Response("Internal server error", { status: 500 });
}

async function getStationPhotoResponse(
  request: Request,
  stationId: string,
  photoKey: string,
): Promise<Response> {
  try {
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return new Response("Too many requests. Please wait a moment and try again.", {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": "10" },
      });
    }

    if (!SAFE_KEY_SEGMENT.test(stationId) || !isSafeRelativeKey(photoKey)) {
      return new Response("Invalid station photo path", { status: 400 });
    }

    let cache: Cache | undefined;
    try {
      cache = await caches.open("station-photos");
      const cacheKey = canonicalMediaCacheKey(request);
      const cached = await cache.match(cacheKey);
      if (cached) {
        // Cache API responses have immutable headers. Clone the response so the app-wide security
        // middleware can attach its headers before sending it to the browser.
        return new Response(cached.body, cached);
      }
    } catch {
      // A Cache API failure must not prevent serving a valid R2 image.
      cache = undefined;
    }

    const { manifest } = await getStationPhotoManifest(request, stationId);
    const image = manifest?.images.find((photo) => photo.key === photoKey);
    if (!image) {
      return new Response("Station photo not found", { status: 404 });
    }

    const object = await env.STATION_IMAGES.get(`stations/${stationId}/${image.key}`);
    if (!object) {
      return new Response("Station photo not found", { status: 404 });
    }

    const expectedContentType = contentTypeForKey(image.key);
    const contentType = normalizeImageContentType(object.httpMetadata?.contentType);
    if (!contentType || contentType !== expectedContentType) {
      return new Response("Station photo not found", {
        status: 415,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const response = new Response(object.body, {
      headers: {
        "Cache-Control": IMAGE_CACHE,
        ETag: object.httpEtag,
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
    if (cache) {
      const cacheKey = canonicalMediaCacheKey(request);
      waitUntil(cache.put(cacheKey, response.clone()).catch(() => undefined));
    }
    return response;
  } catch (error) {
    return internalError(request, error);
  }
}
