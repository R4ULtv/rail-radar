# @repo/data

Shared station data and TypeScript types for Rail Radar.

## Package Structure

```
src/
├── index.ts       # Main entry point
├── stations.ts    # Station data exports
├── types.ts       # TypeScript type definitions
└── stations.json  # Raw station data (4500+ stations)
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
import { stations, stationById, type Station, type Train } from "@repo/data";
```

### Subpath Import (`@repo/data/stations`)

```ts
import { stations, stationById } from "@repo/data/stations";
```

## Data

### `stations`

Array of 4500+ railway stations across Italy and Switzerland.

### `stationById`

Map for O(1) station lookup by ID.

```ts
const station = stationById.get("IT01700"); // Roma Termini
```

## Types

### `Station`

```ts
interface Station {
  id: string;
  name: string;
  type: "rail" | "metro";
  importance: 1 | 2 | 3 | 4;
  geo?: {
    lat: number;
    lng: number;
  };
}
```

**Importance levels:**

| Level | Description                                      |
| ----- | ------------------------------------------------ |
| 1     | Major hubs (e.g., Roma Termini, Milano Centrale) |
| 2     | Important cities                                 |
| 3     | Regional cities                                  |
| 4     | Default (smaller stations)                       |

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

### Get all stations

```ts
import { stations } from "@repo/data";

const allStations = stations;
```

### Filter stations with coordinates

```ts
const withCoords = stations.filter((s) => s.geo);
```

### Lookup station by ID

```ts
import { stationById } from "@repo/data";

const roma = stationById.get("IT01700");
```
