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

export async function getStationPhotos(stationId: string): Promise<StationPhoto[]> {
  try {
    // Photo manifests load in the browser after hydration, while repeat requests are served from
    // the web Worker's edge cache.
    const response = await fetch(`/media/stations/${encodeURIComponent(stationId)}/photos`);

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`Station photos request failed with ${response.status}`);
    }

    const manifest = (await response.json()) as StationPhotosResponse;
    return manifest.stationId === stationId && Array.isArray(manifest.images)
      ? manifest.images
      : [];
  } catch (error) {
    console.warn(`Unable to load station photos for ${stationId}`, error);
    return [];
  }
}
