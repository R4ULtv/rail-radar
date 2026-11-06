import "@tanstack/react-start/server-only";

import snapshot from "@/data/station-photos.json";
import { stationPhotoManifest } from "./station-photos";
import type { StationPhotoInventory } from "./station-photos";

// The CLI validates this checked-in snapshot before building. Only each page's own
// photos are serialized into its loader data; the complete catalog stays on the server.
const inventory: StationPhotoInventory = snapshot;

export const MANIFEST_CACHE = "public, max-age=43200, s-maxage=43200";
export const MISSING_MANIFEST_CACHE = "public, max-age=60, s-maxage=300";

export function getStationPhotoManifest(stationId: string) {
  return stationPhotoManifest(inventory, stationId);
}
