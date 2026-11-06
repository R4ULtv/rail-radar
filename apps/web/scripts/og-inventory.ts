import { createHash } from "node:crypto";
import type { Station } from "../../../packages/data/src/types.ts";
import { OG_VERSION } from "../src/lib/station-og.ts";

export interface ListedOgObject {
  key: string;
  size: number;
  last_modified: string;
  etag?: string;
}

export interface LocalOgImage {
  version: string;
  checksum: string;
}

export function isLocalOgImage(value: unknown): value is LocalOgImage {
  if (typeof value !== "object" || value === null) return false;
  const image = value as Partial<LocalOgImage>;
  return (
    typeof image.version === "string" &&
    OG_VERSION.test(image.version) &&
    typeof image.checksum === "string" &&
    OG_VERSION.test(image.checksum)
  );
}

export function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Include only inputs that the card draws. Importance changes do not redraw an image. */
export function stationInputHash(station: Station, rendererHash: string): string {
  return sha256(
    JSON.stringify({
      rendererHash,
      id: station.id,
      name: station.name.replace(/\s+/g, " ").trim(),
      type: station.type,
      geo: station.geo,
    }),
  );
}
