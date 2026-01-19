# @repo/data

Shared station data and TypeScript types for Rail Radar.

## Package Structure

```
src/
├── index.ts                  # Main entry point
├── stations.ts               # Station data exports
├── types.ts                  # TypeScript type definitions
├── stations.json             # Raw station data
└── stations-with-coords.json # Stations with coordinates
```

## Installation

This package is internal to the monorepo. To use it in an app:

```bash
pnpm add @repo/data --filter=<app>
```

## Exports

The package provides two import paths:

### Default Import (`@repo/data`)

```ts
import { stations, stationsCoords, type Station, type Train } from "@repo/data";
```

## Data

### `stations`

Array of Italian railway stations (raw data).

### `stationsCoords`

Array of 2400+ Italian railway stations with geographic coordinates.

## Types

### `Station`

```ts
interface Station {
  id: number;
  name: string;
  geo?: {
    lat: number;
    lng: number;
  };
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

## Usage

### Import types only

```ts
import type { Station, Train } from "@repo/data";
```

### Get all stations with coordinates

```ts
import { stationsCoords } from "@repo/data";

const allStations = stationsCoords;
```

### Filter stations with coordinates

```ts
const withCoords = stationsCoords.filter((s) => s.geo);
```

### Use in API routes (subpath import)

```ts
import { stationsCoords } from "@repo/data/stations";

const stations = stationsCoords.filter((s) => s.geo);
```
