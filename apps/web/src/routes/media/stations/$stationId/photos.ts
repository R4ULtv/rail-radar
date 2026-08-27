import { env, waitUntil } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";

interface StationPhotoManifest {
  stationId: string;
  images: StationPhoto[];
}

interface StationPhoto {
  key: string;
  url?: string;
  width?: number;
  height?: number;
  alt: string;
  attribution?: {
    author: string;
    origin?: string;
    sourceUrl?: string | null;
    license: string;
  };
}

const MANIFEST_CACHE = "public, max-age=43200, s-maxage=43200";
const MISSING_MANIFEST_CACHE = "public, max-age=60, s-maxage=300";
const SAFE_KEY_SEGMENT = /^[A-Za-z0-9_-]+$/;
const SAFE_RELATIVE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:avif|jpe?g|png|webp)$/i;

export const Route = createFileRoute("/media/stations/$stationId/photos")({
  server: {
    handlers: {
      GET: ({ request, params }) => getStationPhotosResponse(request, params.stationId),
      HEAD: ({ request, params }) => getStationPhotosResponse(request, params.stationId),
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

function normalizeHttpsUrl(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
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
    if (!isRecord(image)) {
      return null;
    }

    if (typeof image.alt !== "string" || image.alt.trim() === "") {
      return null;
    }

    if (typeof image.key !== "string" || !isSafeRelativeKey(image.key)) {
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
      url: `/media/stations/${stationId}/photo/${image.key}`,
      width: typeof image.width === "number" ? image.width : undefined,
      height: typeof image.height === "number" ? image.height : undefined,
      alt: image.alt,
      attribution:
        isRecord(attribution) &&
        typeof attribution.author === "string" &&
        typeof attribution.license === "string"
          ? {
              author: attribution.author,
              origin: typeof attribution.origin === "string" ? attribution.origin : undefined,
              sourceUrl: normalizeHttpsUrl(attribution.sourceUrl),
              license: attribution.license,
            }
          : undefined,
    });
  }

  return { stationId, images };
}

function internalError(request: Request, error: unknown): Response {
  console.error(
    JSON.stringify({
      message: "Station photo manifest request failed",
      path: new URL(request.url).pathname,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return new Response("Internal server error", { status: 500 });
}

async function getStationPhotosResponse(request: Request, stationId: string): Promise<Response> {
  if (!SAFE_KEY_SEGMENT.test(stationId)) {
    return Response.json({ error: "Invalid station id" }, { status: 400 });
  }

  try {
    const cache = await caches.open("station-photos");
    const cacheKey = new Request(request.url, { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) {
      // Cache API responses have immutable headers. Clone the response so the app-wide security
      // middleware can attach its headers before sending it to the browser.
      return new Response(cached.body, cached);
    }

    const object = await env.STATION_IMAGES.get(`stations/${stationId}/manifest.json`);
    if (!object) {
      const response = Response.json(
        { stationId, images: [] },
        { status: 404, headers: { "Cache-Control": MISSING_MANIFEST_CACHE } },
      );
      waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    const manifest = normalizePhotoManifest(await object.json(), stationId);
    if (!manifest) {
      console.error(JSON.stringify({ message: "Invalid station photo manifest", stationId }));
      const response = Response.json(
        { stationId, images: [] },
        { status: 404, headers: { "Cache-Control": MISSING_MANIFEST_CACHE } },
      );
      waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    const response = Response.json(manifest, {
      headers: { "Cache-Control": MANIFEST_CACHE },
    });
    waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    return internalError(request, error);
  }
}
