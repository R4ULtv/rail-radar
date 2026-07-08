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

const MANIFEST_CACHE = `public, max-age=43200, s-maxage=43200`;
const MISSING_MANIFEST_CACHE = "public, max-age=60, s-maxage=300";
const IMAGE_CACHE = "public, max-age=31536000, immutable";
const SAFE_KEY_SEGMENT = /^[A-Za-z0-9_-]+$/;
const SAFE_RELATIVE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_-]*\.[A-Za-z0-9]+$/;

function isSafeKeySegment(value: string) {
  return SAFE_KEY_SEGMENT.test(value);
}

function isSafeRelativeKey(value: string) {
  return SAFE_RELATIVE_KEY.test(value) && !value.includes("//") && !value.includes("..");
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
              sourceUrl:
                typeof attribution.sourceUrl === "string" || attribution.sourceUrl === null
                  ? attribution.sourceUrl
                  : undefined,
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

async function getPhotoManifest(bucket: R2Bucket, stationId: string) {
  const object = await bucket.get(`stations/${stationId}/manifest.json`);
  if (!object) {
    return null;
  }

  const manifest = normalizePhotoManifest(await object.json(), stationId);
  if (!manifest) {
    throw new Error(`Invalid station photo manifest for ${stationId}`);
  }

  return manifest;
}

export async function getStationPhotos(c: AppContext) {
  const stationId = c.req.param("id");
  if (typeof stationId !== "string" || !isSafeKeySegment(stationId)) {
    return c.json({ error: "Invalid station id" }, 400);
  }

  const manifest = await getPhotoManifest(c.env.STATION_IMAGES, stationId);
  if (!manifest) {
    c.header("Cache-Control", MISSING_MANIFEST_CACHE);
    return c.json({ stationId, images: [] }, 404);
  }

  c.header("Cache-Control", MANIFEST_CACHE);
  return c.json(manifest);
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

  const manifest = await getPhotoManifest(c.env.STATION_IMAGES, stationId);
  const image = manifest?.images.find((photo) => photo.key === photoKey);
  if (!image) {
    return c.text("Station photo not found", 404);
  }

  const object = await c.env.STATION_IMAGES.get(`stations/${stationId}/${image.key}`);
  if (!object) {
    return c.text("Station photo not found", 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", IMAGE_CACHE);
  headers.set("ETag", object.httpEtag);
  headers.set("Content-Type", headers.get("Content-Type") ?? "image/webp");

  return new Response(object.body, { headers });
}
