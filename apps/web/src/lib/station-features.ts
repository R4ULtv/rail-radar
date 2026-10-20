import type { Station } from "@repo/data";

/** The map's GeoJSON source of every station, loaded from the API's `/stations.geojson`. */
export const STATIONS_SOURCE_ID = "stations-source";

/** The station a feature of the stations source stands for. */
export function stationFromFeature(feature: GeoJSON.Feature): Station | null {
  if (!feature.properties || feature.geometry?.type !== "Point") return null;

  const id = feature.properties.id as string | undefined;
  const name = feature.properties.name as string | undefined;
  if (id === undefined || name === undefined) return null;

  const type = feature.properties.type as Station["type"];
  const importance = (feature.properties.importance ?? 4) as Station["importance"];
  const [lng, lat] = feature.geometry.coordinates;
  return { id, name, type, importance, geo: { lat: lat!, lng: lng! } };
}
