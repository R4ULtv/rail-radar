# @repo/data

Shared station data and TypeScript types for Rail Radar.

## Package Structure

```
src/
├── index.ts            # Main entry point
├── stations.ts         # Station data exports (GeoJSON + derived arrays)
├── countries.ts        # Country codes and lookup utilities
├── operators.ts        # Operator data loader and exports
├── operators.json      # Train operator dataset
├── types.ts            # TypeScript type definitions
└── stations.geojson    # GeoJSON FeatureCollection (21,000+ stations)
```

## Exports

The package provides a root type import path and runtime subpath imports:

### Type Import (`@repo/data`)

```ts
import {
  type Station,
  type Train,
  type StationFeatureCollection,
  type StationFeature,
  type StationProperties,
} from "@repo/data";
```

### Subpath Import (`@repo/data/stations`)

```ts
import { stations, stationById, stationsGeoJSON } from "@repo/data/stations";
```

### Subpath Import (`@repo/data/operators`)

```ts
import { operators, operatorBySlug } from "@repo/data/operators";
import type { Operator } from "@repo/data";
```

### Subpath Import (`@repo/data/types`)

```ts
import type { Station, Operator, Train } from "@repo/data/types";
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

This is served directly by the API as the `/stations.geojson` endpoint and consumed by Mapbox GL JS.

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
getCountry("DE00261"); // "de"
getCountry("FI001"); // "fi"
getCountry("BE95000"); // "be"
getCountry("DK00626"); // "dk"
getCountry("NL8400058"); // "nl"
getCountry("NO0300"); // "no"
getCountry("SE740000001"); // "se"
getCountry("PL10009"); // "pl"
getCountry("UK1072"); // "uk"
getCountry("IE360"); // "ie"
getCountry("FR751008"); // "fr"
getCountry("IT01700", { format: "name" }); // "Italy"
```

### `operators`

Array of all `Operator` objects loaded from `operators.json`.

### `operatorBySlug`

Map for O(1) operator lookup by slug.

```ts
const operator = operatorBySlug.get("trenitalia"); // Trenitalia
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

### `Operator`

```ts
interface Operator {
  slug: string;
  name: string;
  logoPath: string;
  countries: OperatorCountry[]; // CountryCode | "international"
  operatorTypes: OperatorType[]; // "passenger" | "cargo" | "metro" | "light-rail"
  bounds: [number, number, number, number]; // [west, south, east, north]
  description: string;
  website: string;
  founded: number | null;
  headquarters: string | null;
  networkKm: number | null;
  annualPassengers: number | null;
  serviceTypes: ServiceType[]; // "high-speed" | "intercity" | "regional" | "commuter" | "night-train" | "international" | "scenic"
  parentCompany: string | null;
  links: OperatorLink[];
}
```
