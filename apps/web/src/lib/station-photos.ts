export interface StationPhotoAttribution {
  author: string;
  license: string;
  origin?: string;
  sourceUrl?: string | null;
}

export interface StationPhoto {
  key: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  attribution: StationPhotoAttribution;
}

export interface StationPhotoManifest {
  stationId: string;
  images: StationPhoto[];
}

export type StationPhotoMetadata = Omit<StationPhoto, "url">;
export type StationPhotoInventory = Record<string, StationPhotoMetadata[]>;

export const PHOTO_INVENTORY_KEY = "stations/inventory.json";
export const SAFE_KEY_SEGMENT = /^[A-Za-z0-9_-]+$/;
const SAFE_RELATIVE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:avif|jpe?g|png|webp)$/i;

export function isSafeRelativeKey(value: string): boolean {
  return SAFE_RELATIVE_KEY.test(value) && !value.includes("//") && !value.includes("..");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reject an invalid catalog in full, rather than silently dropping a station's photos. */
export function parseStationPhotoInventory(value: unknown): StationPhotoInventory {
  if (!isRecord(value)) throw new Error("Station photo inventory must be an object");

  const entries = Object.entries(value).map(([stationId, images]) => {
    if (!/^[A-Z]+\d+$/.test(stationId) || !Array.isArray(images)) {
      throw new Error(`Invalid station photo entry: ${stationId}`);
    }

    const keys = new Set<string>();
    const photos = images.map((image: unknown): StationPhotoMetadata => {
      if (
        !isRecord(image) ||
        typeof image.key !== "string" ||
        !isSafeRelativeKey(image.key) ||
        keys.has(image.key) ||
        typeof image.alt !== "string" ||
        !image.alt.trim() ||
        typeof image.width !== "number" ||
        !Number.isSafeInteger(image.width) ||
        image.width <= 0 ||
        typeof image.height !== "number" ||
        !Number.isSafeInteger(image.height) ||
        image.height <= 0
      ) {
        throw new Error(`Invalid or duplicate photo in ${stationId}`);
      }

      const credit = image.attribution;
      if (
        !isRecord(credit) ||
        typeof credit.author !== "string" ||
        !credit.author.trim() ||
        typeof credit.license !== "string" ||
        !credit.license.trim() ||
        (credit.origin !== undefined && typeof credit.origin !== "string")
      ) {
        throw new Error(`Invalid attribution: ${stationId}/${image.key}`);
      }
      if (credit.sourceUrl !== undefined && credit.sourceUrl !== null) {
        if (typeof credit.sourceUrl !== "string" || !URL.canParse(credit.sourceUrl)) {
          throw new Error(`Invalid source URL: ${stationId}/${image.key}`);
        }
        if (new URL(credit.sourceUrl).protocol !== "https:") {
          throw new Error(`Source URL must use HTTPS: ${stationId}/${image.key}`);
        }
      }

      keys.add(image.key);
      return {
        key: image.key,
        width: image.width,
        height: image.height,
        alt: image.alt,
        attribution: {
          author: credit.author,
          license: credit.license,
          ...(credit.origin !== undefined && { origin: credit.origin }),
          ...(credit.sourceUrl !== undefined && { sourceUrl: credit.sourceUrl as string | null }),
        },
      };
    });

    return [stationId, photos] as const;
  });

  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

export function stationPhotoManifest(
  inventory: StationPhotoInventory,
  stationId: string,
): StationPhotoManifest | null {
  if (!Object.hasOwn(inventory, stationId)) return null;
  return {
    stationId,
    images: inventory[stationId]!.map((image) => ({
      ...image,
      url: `/media/stations/${stationId}/photo/${image.key}`,
    })),
  };
}

export function canonicalMediaCacheKey(request: Request): Request {
  const url = new URL(request.url);
  url.search = "";
  url.hash = "";
  return new Request(url.toString(), { method: "GET" });
}
