import type { Context } from "hono";
import type { AppBindings } from "./index";

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

type AppContext = Context<{ Bindings: AppBindings }>;

type PhotoManifestResult =
  | { status: "found"; manifest: StationPhotoManifest }
  | { status: "missing" }
  | { status: "invalid" };

interface CacheResult {
  response: Response;
  cacheable: boolean;
}

const MANIFEST_CACHE = `public, max-age=43200, s-maxage=43200`;
const MISSING_MANIFEST_CACHE = "public, max-age=60, s-maxage=300";
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

async function withEdgeCache(c: AppContext, build: () => Promise<CacheResult>): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(c.req.url, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  const { response, cacheable } = await build();
  if (cacheable && response.headers.has("Cache-Control")) {
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
}

function isSafeKeySegment(value: string) {
  return SAFE_KEY_SEGMENT.test(value);
}

function isSafeRelativeKey(value: string) {
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
    if (attribution !== undefined) {
      if (
        !isRecord(attribution) ||
        typeof attribution.author !== "string" ||
        typeof attribution.license !== "string"
      ) {
        return null;
      }
    }

    images.push({
      key: image.key,
      url: `/stations/${stationId}/photo/${image.key}`,
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

  return {
    stationId,
    images,
  };
}

async function getPhotoManifest(bucket: R2Bucket, stationId: string): Promise<PhotoManifestResult> {
  const object = await bucket.get(`stations/${stationId}/manifest.json`);
  if (!object) {
    return { status: "missing" };
  }

  const manifest = normalizePhotoManifest(await object.json(), stationId);
  if (!manifest) {
    console.error(`Invalid station photo manifest for ${stationId}`);
    return { status: "invalid" };
  }

  return { status: "found", manifest };
}

export async function getStationPhotos(c: AppContext) {
  const stationId = c.req.param("id");
  if (typeof stationId !== "string" || !isSafeKeySegment(stationId)) {
    return c.json({ error: "Invalid station id" }, 400);
  }

  return withEdgeCache(c, async () => {
    const result = await getPhotoManifest(c.env.STATION_IMAGES, stationId);
    if (result.status !== "found") {
      c.header("Cache-Control", MISSING_MANIFEST_CACHE);
      return {
        response: c.json({ stationId, images: [] }, 404),
        cacheable: true,
      };
    }

    c.header("Cache-Control", MANIFEST_CACHE);
    return { response: c.json(result.manifest), cacheable: true };
  });
}

export async function getStationPhoto(c: AppContext) {
  const stationId = c.req.param("id");
  if (typeof stationId !== "string" || !isSafeKeySegment(stationId)) {
    return c.text("Invalid station photo path", 400);
  }

  const photoKey = c.req.path.split(`/stations/${stationId}/photo/`)[1] ?? "";

  if (!isSafeRelativeKey(photoKey)) {
    return c.text("Invalid station photo path", 400);
  }

  return withEdgeCache(c, async () => {
    const result = await getPhotoManifest(c.env.STATION_IMAGES, stationId);

    const image =
      result.status === "found"
        ? result.manifest.images.find((photo) => photo.key === photoKey)
        : undefined;
    if (!image) {
      return { response: c.text("Station photo not found", 404), cacheable: false };
    }

    const object = await c.env.STATION_IMAGES.get(`stations/${stationId}/${image.key}`);
    if (!object) {
      return { response: c.text("Station photo not found", 404), cacheable: false };
    }

    const expectedContentType = contentTypeForKey(image.key);
    const contentType = normalizeImageContentType(object.httpMetadata?.contentType);
    if (!contentType || contentType !== expectedContentType) {
      return {
        response: c.text("Station photo not found", 415, {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        }),
        cacheable: false,
      };
    }

    const headers = new Headers();
    headers.set("Cache-Control", IMAGE_CACHE);
    headers.set("ETag", object.httpEtag);
    headers.set("Content-Type", contentType);
    headers.set("X-Content-Type-Options", "nosniff");

    return {
      response: new Response(object.body, { headers }),
      cacheable: true,
    };
  });
}
