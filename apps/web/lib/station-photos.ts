import { staticAssetUrl } from "@/lib/static-assets";

export interface StationPhotoAttribution {
  author?: string;
  license?: string;
  origin?: string;
  sourceUrl?: string | null;
}

export interface StationPhoto {
  key: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  attribution?: StationPhotoAttribution;
}

interface StationPhotosResponse {
  stationId: string;
  images: StationPhoto[];
}

function normalizePhotoUrl(photo: StationPhoto): StationPhoto {
  return {
    ...photo,
    url: photo.url.startsWith("/") ? staticAssetUrl(photo.url as `/${string}`) : photo.url,
  };
}

export async function getStationPhotos(stationId: string): Promise<StationPhoto[]> {
  try {
    // The station page is force-dynamic, so Next does not cache this fetch.
    // Repeat requests are served from the static.railradar24.com edge cache
    // (see apps/static/src/station-photos.ts).
    const response = await fetch(staticAssetUrl(`/stations/${stationId}/photos`));

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`Station photos request failed with ${response.status}`);
    }

    const manifest = (await response.json()) as StationPhotosResponse;
    return manifest.stationId === stationId && Array.isArray(manifest.images)
      ? manifest.images.map(normalizePhotoUrl)
      : [];
  } catch (error) {
    console.warn(`Unable to load station photos for ${stationId}`, error);
    return [];
  }
}
