import { env } from "cloudflare:workers";

export interface StationPhotoManifest {
  stationId: string;
  images: StationPhoto[];
}

export interface StationPhoto {
  key: string;
  url: string;
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

export interface StationPhotoManifestCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface StationPhotoManifestRuntime {
  openCache?: () => Promise<StationPhotoManifestCache>;
  getManifest?: (stationId: string) => Promise<{ json(): Promise<unknown> } | null>;
}

export interface StationPhotoManifestLookup {
  manifest: StationPhotoManifest | null;
  response: Response;
}

export const MANIFEST_CACHE = "public, max-age=43200, s-maxage=43200";
export const MISSING_MANIFEST_CACHE = "public, max-age=60, s-maxage=300";
export const SAFE_KEY_SEGMENT = /^[A-Za-z0-9_-]+$/;
export const SAFE_RELATIVE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:avif|jpe?g|png|webp)$/i;

function defaultOpenCache(): Promise<StationPhotoManifestCache> {
  return caches.open("station-photos");
}

function defaultGetManifest(stationId: string) {
  return env.STATION_IMAGES.get(`stations/${stationId}/manifest.json`);
}

export function isSafeRelativeKey(value: string): boolean {
  return SAFE_RELATIVE_KEY.test(value) && !value.includes("//") && !value.includes("..");
}

export function normalizeHttpsUrl(value: unknown): string | null | undefined {
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

export function normalizePhotoManifest(
  value: unknown,
  stationId: string,
): StationPhotoManifest | null {
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

export function canonicalMediaCacheKey(request: Request): Request {
  const url = new URL(request.url);
  url.search = "";
  url.hash = "";
  return new Request(url.toString(), { method: "GET" });
}

export function canonicalStationPhotoManifestCacheKey(
  request: Request,
  stationId: string,
): Request {
  const url = new URL(request.url);
  url.pathname = `/media/stations/${stationId}/photos`;
  url.search = "";
  url.hash = "";
  return new Request(url.toString(), { method: "GET" });
}

function negativeManifestResponse(stationId: string): Response {
  return Response.json(
    { stationId, images: [] },
    { status: 404, headers: { "Cache-Control": MISSING_MANIFEST_CACHE } },
  );
}

function cloneResponse(response: Response): Response {
  return new Response(response.body, response);
}

async function readCachedManifest(
  cache: StationPhotoManifestCache,
  cacheKey: Request,
  stationId: string,
): Promise<StationPhotoManifestLookup | null> {
  let cached: Response | undefined;
  try {
    cached = await cache.match(cacheKey);
  } catch {
    return null;
  }

  if (!cached) {
    return null;
  }

  if (cached.status === 404) {
    return { manifest: null, response: cloneResponse(cached) };
  }

  try {
    const manifest = normalizePhotoManifest(await cached.clone().json(), stationId);
    return manifest ? { manifest, response: cloneResponse(cached) } : null;
  } catch {
    return null;
  }
}

async function cacheResponse(
  cache: StationPhotoManifestCache | undefined,
  cacheKey: Request,
  response: Response,
): Promise<void> {
  if (!cache) {
    return;
  }

  try {
    await cache.put(cacheKey, response.clone());
  } catch {
    // Cache failures must not make a valid R2 response fail.
  }
}

export async function getStationPhotoManifest(
  request: Request,
  stationId: string,
  runtime: StationPhotoManifestRuntime = {},
): Promise<StationPhotoManifestLookup> {
  const cacheKey = canonicalStationPhotoManifestCacheKey(request, stationId);
  let cache: StationPhotoManifestCache | undefined;

  try {
    cache = await (runtime.openCache ?? defaultOpenCache)();
  } catch {
    cache = undefined;
  }

  if (cache) {
    const cached = await readCachedManifest(cache, cacheKey, stationId);
    if (cached) {
      return cached;
    }
  }

  const object = await (runtime.getManifest ?? defaultGetManifest)(stationId);
  if (!object) {
    const response = negativeManifestResponse(stationId);
    await cacheResponse(cache, cacheKey, response);
    return { manifest: null, response };
  }

  const manifest = normalizePhotoManifest(await object.json(), stationId);
  if (!manifest) {
    console.error(JSON.stringify({ message: "Invalid station photo manifest", stationId }));
    const response = negativeManifestResponse(stationId);
    await cacheResponse(cache, cacheKey, response);
    return { manifest: null, response };
  }

  const response = Response.json(manifest, { headers: { "Cache-Control": MANIFEST_CACHE } });
  await cacheResponse(cache, cacheKey, response);
  return { manifest, response };
}
