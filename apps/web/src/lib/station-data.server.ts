import "@tanstack/react-start/server-only";

import {
  COUNTRY_CODES,
  COUNTRY_MAP,
  COUNTRY_SLUG,
  getCountry,
  getCountryBySlug,
  getCountrySlug,
} from "@repo/data/countries";
import { countryStationBounds, stationsByCountry } from "@repo/data/directory";
import { stationById, stations } from "@repo/data/stations";
import type { Station } from "@repo/data";
import type { Metadata } from "@/lib/metadata";

export type StationWithGeo = Station & { geo: { lat: number; lng: number } };
export type NearbyStation = StationWithGeo & { distance: number };

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;
const MAX_HUBS = 24;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const lat1Rad = lat1 * DEG_TO_RAD;
  const lat2Rad = lat2 * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestStations(
  currentStation: StationWithGeo,
  predicate: (station: Station) => boolean,
  limit: number,
): NearbyStation[] {
  const result: NearbyStation[] = [];

  for (const station of stations) {
    if (station.id === currentStation.id || !station.geo || !predicate(station)) continue;

    const distance = haversineDistance(
      currentStation.geo.lat,
      currentStation.geo.lng,
      station.geo.lat,
      station.geo.lng,
    );
    let index = result.findIndex((candidate) => candidate.distance >= distance);
    if (index === -1) index = result.length;
    result.splice(index, 0, { ...(station as StationWithGeo), distance });
    if (result.length > limit) result.pop();
  }

  return result;
}

export function getRailStation(id: string): StationWithGeo | null {
  const station = stationById.get(id);
  if (!station?.geo || station.type !== "rail") return null;
  return station as StationWithGeo;
}

export function getNearbyStations(station: StationWithGeo): NearbyStation[] {
  const nearbyRail = nearestStations(station, (candidate) => candidate.type === "rail", 4);
  const nearbyMetro = nearestStations(station, (candidate) => candidate.type === "metro", 1);

  return [...nearbyRail, ...nearbyMetro].sort((a, b) => a.distance - b.distance).slice(0, 4);
}

function getStationMetadata(station: StationWithGeo): Metadata {
  const country = getCountry(station.id, { format: "name" });
  const description = `Live train departures and arrivals at ${station.name}, ${country}. Check real-time delays, platform numbers, and schedules updated every 30 seconds.`;

  return {
    title: `${station.name} - Live Departures & Arrivals`,
    description,
    alternates: {
      canonical: `/station/${station.id}`,
    },
    openGraph: {
      title: `${station.name} - Live Departures & Arrivals | Rail Radar`,
      description,
      images: [
        {
          url: `/media/og?id=${station.id}`,
          width: 1200,
          height: 630,
          alt: `${station.name} station map`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${station.name} - Live Departures & Arrivals | Rail Radar`,
      description,
      images: [`/media/og?id=${station.id}`],
    },
  };
}

export function getStationPageData(id: string) {
  const station = getRailStation(id);
  if (!station) return null;

  const code = getCountry(station.id);
  return {
    station,
    nearbyStations: getNearbyStations(station),
    code,
    countryCode: code?.toUpperCase() ?? null,
    country: getCountry(station.id, { format: "name" }),
    countrySlug: code ? getCountrySlug(code) : null,
    metadata: getStationMetadata(station),
  };
}

function pageCopy(countryName: string, count: number) {
  return {
    title: `Train Stations in ${countryName} - Live Departures & Arrivals`,
    description: `Browse all ${count.toLocaleString()} train stations in ${countryName} on Rail Radar. Find live departures, arrivals, real-time delays, and platform information for every station.`,
  };
}

function getCountryMetadata(slug: string, countryName: string, count: number): Metadata {
  const { title, description } = pageCopy(countryName, count);

  return {
    title,
    description,
    alternates: {
      canonical: `/stations/${slug}`,
    },
    openGraph: {
      title: `${title} | Rail Radar`,
      description,
      images: [
        {
          url: "/assets/social/operators.webp",
          width: 1200,
          height: 630,
          alt: `Rail Radar - Train stations in ${countryName}`,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: `${title} | Rail Radar`,
      description,
      images: ["/assets/social/operators.webp"],
    },
  };
}

function indexKey(name: string): string {
  const first = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .charAt(0)
    .toUpperCase();

  return /[A-Z]/.test(first) ? first : "#";
}

function boundsToView(bounds: [number, number, number, number]) {
  const [west, south, east, north] = bounds;
  const lat = (south + north) / 2;
  const lng = (west + east) / 2;
  const maxSpan = Math.max(north - south, east - west) || 1;
  const zoom = Math.floor(Math.log2(360 / maxSpan));

  return {
    lat: +lat.toFixed(4),
    lng: +lng.toFixed(4),
    zoom: Math.min(Math.max(zoom, 3), 18),
  };
}

export function getCountryStationsPageData(slug: string) {
  const code = getCountryBySlug(slug);
  if (!code) return null;

  const allStations = stationsByCountry.get(code) ?? [];
  const bounds = countryStationBounds.get(code);
  if (allStations.length === 0 || !bounds) return null;

  const countryName = COUNTRY_MAP[code];
  const sections = new Map<string, StationWithGeo[]>();
  for (const station of allStations) {
    const key = indexKey(station.name);
    (sections.get(key) ?? sections.set(key, []).get(key)!).push(station);
  }

  const alphabeticalSections = [...sections]
    .sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
    .map(([letter, sectionStations]) => ({ letter, stations: sectionStations }));
  const hubs = allStations
    .filter((station) => station.importance <= 2)
    .sort((a, b) => a.importance - b.importance || a.name.localeCompare(b.name))
    .slice(0, MAX_HUBS);

  return {
    slug,
    code,
    countryName,
    count: allStations.length,
    bounds,
    mapView: boundsToView(bounds),
    hubs,
    sections: alphabeticalSections,
    metadata: getCountryMetadata(slug, countryName, allStations.length),
  };
}

export function getStationsDirectoryPageData() {
  const countries = COUNTRY_CODES.map((code) => ({
    code,
    name: COUNTRY_MAP[code],
    slug: COUNTRY_SLUG[code],
    count: stationsByCountry.get(code)?.length ?? 0,
  }))
    .filter((country) => country.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const totalStations = countries.reduce((total, country) => total + country.count, 0);

  return {
    countries,
    totalStations,
    metadata: {
      title: "Train Stations - Browse by Country",
      description: `Browse ${totalStations.toLocaleString()} train stations across ${countries.length} European countries on Rail Radar. Find live departures, arrivals, and real-time schedules for every station.`,
      alternates: {
        canonical: "/stations",
      },
      openGraph: {
        images: [
          {
            url: "/assets/social/operators.webp",
            width: 1200,
            height: 630,
            alt: "Rail Radar - Train stations across Europe",
          },
        ],
      },
    } satisfies Metadata,
  };
}
