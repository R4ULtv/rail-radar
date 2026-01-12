# @repo/data

Shared station data and TypeScript types for Rail Radar.

## Installation

This package is internal to the monorepo. To use it in an app:

```bash
pnpm add @repo/data --filter=<app>
```

## Exports

### `stationsCoords`

Array of 2400+ Italian railway stations with geographic coordinates.

```ts
import { stationsCoords } from "@repo/data";

// Each station has: id, name, and optional geo (lat/lng)
```

### Types

#### `Station`

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

#### `Train`

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

```ts
import { stationsCoords, type Station, type Train } from "@repo/data";

// Get all stations
const allStations = stationsCoords;

// Filter stations with coordinates
const withCoords = stationsCoords.filter((s) => s.geo);
```
