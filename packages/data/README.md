# @repo/data

Shared station data and TypeScript types for Rail Radar.

## Package Structure

```
src/
├── index.ts           # Main entry point
├── stations.ts        # Station data exports (GeoJSON + derived arrays)
├── countries.ts       # Country codes and lookup utilities
├── brands.ts          # Train brand/operator definitions
├── types.ts           # TypeScript type definitions
├── geojson.d.ts       # Module declaration for .geojson imports
└── stations.geojson   # GeoJSON FeatureCollection (8900+ stations)

scripts/
├── convert-to-geojson.ts  # Converts stations.json → stations.geojson
└── format-stations.ts     # Formats stations.json (sort + minify)
```

## Exports

The package provides three import paths:

### Default Import (`@repo/data`)

```ts
import {
  stations,
  stationById,
  stationsGeoJSON,
  getCountry,
  COUNTRY_CODES,
  BRANDS,
  type Station,
  type Train,
  type Brand,
  type StationFeatureCollection,
  type StationFeature,
  type StationProperties,
  type CountryCode,
  type CountryName,
} from "@repo/data";
```

### Subpath Import (`@repo/data/stations`)

```ts
import { stations, stationById, stationsGeoJSON } from "@repo/data/stations";
```

### Subpath Import (`@repo/data/countries`)

```ts
import { getCountry, COUNTRY_CODES } from "@repo/data/countries";
```

## Data

### `stationsGeoJSON`

A typed GeoJSON `FeatureCollection<Point, StationProperties>` containing all stations. Each feature has:

- `properties.id` — station ID (e.g., `"IT01700"`)
- `properties.name` — station name
- `properties.type` — `"rail"`, `"metro"`, or `"light"` (light rail: trams and train-like services)
- `properties.importance` — `1`–`4`
- `geometry.coordinates` — `[lng, lat]`

This is served directly by the API as the `/stations` GeoJSON endpoint and consumed by MapBox GL JS.

### `stations`

Derived flat array of `Station` objects (backward compat for API search, server components, etc.).

### `stationById`

Map for O(1) station lookup by ID.

```ts
const station = stationById.get("IT01700"); // Roma Termini
```

### `getCountry`

Get country from a station ID. Returns a country code by default, or a full name with `format: "name"`.

```ts
getCountry("IT01700"); // "it"
getCountry("CH8503000"); // "ch"
getCountry("FI001"); // "fi"
getCountry("BE95000"); // "be"
getCountry("NL8400058"); // "nl"
getCountry("UK1072"); // "uk"
getCountry("IE360"); // "ie"
getCountry("IT01700", { format: "name" }); // "italy"
```

## Types

### `Station`

```ts
interface Station {
  id: string;
  name: string;
  type: "rail" | "metro" | "light";
  importance: 1 | 2 | 3 | 4;
  geo?: { lat: number; lng: number };
}
```

**Importance levels (rail):**

| Level | Description                                      |
| ----- | ------------------------------------------------ |
| 1     | Major hubs (e.g., Roma Termini, Milano Centrale) |
| 2     | Important cities                                 |
| 3     | Regional cities                                  |
| 4     | Default (smaller stations)                       |

**Importance levels (light rail):**

| Level | Description                                                                    |
| ----- | ------------------------------------------------------------------------------ |
| 3     | Train-like services — S-Bahn, suburban rail (e.g., Forchbahn, Circumvesuviana) |
| 4     | Trams / streetcars (e.g., Oslo tram, Dublin Luas, Bergamo T1)                  |

### `StationProperties`

GeoJSON feature properties with required fields for map rendering:

```ts
interface StationProperties {
  id: string;
  name: string;
  type: "rail" | "metro" | "light";
  importance: 1 | 2 | 3 | 4;
}
```

### `Train`

```ts
interface Train {
  brand: string | null;
  category: string | null;
  trainNumber: string;
  origin?: string;
  destination?: string;
  scheduledTime: string;
  delay: number | null;
  platform: string | null;
  status: "incoming" | "departing" | "cancelled" | null;
  info: string | null;
}
```

## Scripts

### `convert-to-geojson.ts`

Converts `stations.json` into `stations.geojson`. Computes `minzoom` from importance and station type, excludes stations without coordinates, and adds country codes.

### `format-stations.ts`

Normalizes `stations.json` by sorting stations alphabetically and minifying. Run after manual edits to ensure consistent formatting.
