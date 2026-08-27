import { env, waitUntil } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";

interface StationPhotoManifest {
  stationId: string;
  images: StationPhoto[];
}

interface StationPhoto {
  key: string;
  alt: string;
  attribution?: {
    author: string;
    license: string;
  };
}

const IMAGE_CACHE = "public, max-age=31536000, immutable";
const SAFE_KEY_SEGMENT = /^[A-Za-z0-9_-]+$/;
const SAFE_RELATIVE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:avif|jpe?g|png|webp)$/i;
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

function isSafeRelativeKey(value: string): boolean {
  return SAFE_RELATIVE_KEY.test(value) && !value.includes("//") && !value.includes("..");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePhotoManifest(value: unknown, stationId: string): StationPhotoManifest | null {
  if (!isRecord(value) || value.stationId !== stationId || !Array.isArray(value.images)) {
    return null;
  }

  const images: StationPhoto[] = [];

  for (const image of value.images) {
    if (
      !isRecord(image) ||
      typeof image.alt !== "string" ||
      image.alt.trim() === "" ||
      typeof image.key !== "string" ||
      !isSafeRelativeKey(image.key)
    ) {
      return null;
    }

    const attribution = image.attribution;
    if (
      attribution !== undefined &&
      (!isRecord(attribution) ||
        typeof attribution.author !== "string" ||
        typeof attribution.license !== "string")
    ) {
      return null;
    }

    images.push({
      key: image.key,
      alt: image.alt,
      attribution:
        isRecord(attribution) &&
        typeof attribution.author === "string" &&
        typeof attribution.license === "string"
          ? { author: attribution.author, license: attribution.license }
          : undefined,
    });
  }

  return { stationId, images };
}

async function getPhotoManifest(stationId: string): Promise<StationPhotoManifest | null> {
  const object = await env.STATION_IMAGES.get(`stations/${stationId}/manifest.json`);
  if (!object) {
    return null;
  }

  const manifest = normalizePhotoManifest(await object.json(), stationId);
  if (!manifest) {
    console.error(JSON.stringify({ message: "Invalid station photo manifest", stationId }));
  }
  return manifest;
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

    const cache = await caches.open("station-photos");
    const cacheKey = new Request(request.url, { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) {
      // Cache API responses have immutable headers. Clone the response so the app-wide security
      // middleware can attach its headers before sending it to the browser.
      return new Response(cached.body, cached);
    }

    const manifest = await getPhotoManifest(stationId);
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
    waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    return internalError(request, error);
  }
}
