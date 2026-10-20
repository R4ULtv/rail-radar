# @repo/data

Shared station data and TypeScript types for Rail Radar.

## Package Structure

```
src/
├── index.ts            # Main entry point
├── stations.ts         # Station data exports (GeoJSON + derived arrays)
├── directory.ts        # Stations grouped by country and country bounds
├── countries.ts        # Country codes and lookup utilities
├── operators.ts        # Operator data loader and exports
├── operators.json      # Train operator dataset
├── lines.ts            # Line exports, validation and station-to-line/route lookups
├── lines.json          # Every line with its ordered stops (no track)
├── lines/              # One GeoJSON track file per line: <line-id>.json
├── types.ts            # TypeScript type definitions
└── stations.geojson    # GeoJSON FeatureCollection (22,000+ stations)
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

### Subpath Import (`@repo/data/directory`)

```ts
import { countryStationBounds, stationsByCountry } from "@repo/data/directory";
```

## Data

### `stationsGeoJSON`

A typed GeoJSON `FeatureCollection<Point, StationProperties>` containing all stations. Each feature has:

- `properties.id` — station ID (e.g., `"IT01700"`), prefixed by country and optionally `M` for metro or `L` for light rail
- `properties.name` — station name
- `properties.type` — `"rail"`, `"metro"`, or `"light"` (light rail: trams and train-like services)
- `properties.importance` — `1`–`4`
- `geometry.coordinates` — `[lng, lat]`

This is served directly by the API as the `/stations.geojson` endpoint and consumed by Mapbox GL JS.

### `stations`

Derived flat array of `Station` objects used by API search and server-side web routes.

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
getCountry("LU200405060"); // "lu"
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

## Transit lines

`src/lines.json` stores the metro and selected light rail catalog. Each line has a
stable `id` (for example, `it-milano-m1`), a public `name` and optional description,
a nullable public `code`, a `metro` or `light` type, a color and operator slug
(both nullable), and one or more routes. `operator` refers to `operators.json`; colors use
uppercase `#RRGGBB`, with `null` rendered using `DEFAULT_LINE_COLOR`.

Each route contains an ordered `stations` array of canonical station IDs and an
optional public route `code`. Station names and coordinates come from the station
registry. Routes represent distinct branches or stop patterns:

- The first and last stations are the termini. A loop may repeat stations.
- Opposite directions with the same stops share one route, read in reverse.
  Directions with different stops have separate routes.
- Short workings contained within another route are omitted.
- Routes have no stable IDs; use the line ID for links and persisted references.

Track is stored separately as a GeoJSON `MultiLineString` in
`src/lines/<line-id>.json`, using `[longitude, latitude]` coordinates. Importing the
catalog does not load geometry; load each track file only when needed.

```ts
import { lineById, getStationLines, getStationRoutes } from "@repo/data/lines";
import type { Line, LineRoute, LineGeometry } from "@repo/data";

const line = lineById.get("it-milano-m1");
const servingLines = getStationLines("ITM125");
const servingRoutes = getStationRoutes("ITM125"); // { line, route } matches
const { default: track } = await import("@repo/data/lines/it-milano-m1.json", {
  with: { type: "json" },
});
```

Edit lines and track in Studio. `validateLines` checks catalog fields and station
references; `validateLineGeometry` checks track coordinates. Both are exported
from `@repo/data/lines`. The raw catalog is available as `@repo/data/lines.json`.
Line data describes published stop patterns, not live departures or disruptions.
