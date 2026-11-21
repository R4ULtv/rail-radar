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
└── stations.geojson    # GeoJSON FeatureCollection (26,000+ stations)
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

### Czech stations

Passenger rail IDs, official names and coordinates come from Správa železnic's
[SR70 directory](https://provoz.spravazeleznic.cz/portal/ViewArticle.aspx?oid=34462).
Each record also matches a [GRAPP network point](https://grapp.spravazeleznic.cz/).
The ID combines `CZ54` with the first five digits of the six-digit national SR70
number, retaining leading zeros. For example, `CZ5453613` identifies Pardubice
hlavní nádraží and `CZ5474632` identifies Obrataň.

The importer confirms passenger use against the full station name in the
[CIS station list](https://portal.cisjr.cz/pub/seznamy/stanice.csv). It supplements
this list with national codes verified in [SŽ's published route timetables](https://provoz.spravazeleznic.cz/portal/ViewArticle.aspx?oid=2286145)
and [Gepard Express's timetable for lines 228 and 229](https://uzkokolejky.cz/wp-content/uploads/2026/08/uzkokolejka_jizdni_rad_A3-01-web.pdf).
These include seasonal services. Station inclusion does not establish that trains
run on a particular date or that a live board is available.

```bash
python3 scripts/import-czech-stations.py
python3 scripts/import-czech-stations.py --check
```

The default SR70 workbook is effective 15 October–12 December 2026. For a later
import, select the applicable workbook with `--sr70-url` and review the supplemental
codes against the corresponding timetables. Run the repository formatter after importing.
The importer matches GRAPP aliases to eligible SR70 records at the exact coordinates.
When the sources differ, it accepts a unique matching name within one kilometre for
ordinary GRAPP points. Operational GRAPP points (`STI === "33"`) require an exact
coordinate match. Importance is 1 for the Praha, Brno and Ostrava main stations,
2 for GRAPP major nodes, 3 for SR70 transport nodes and 4 otherwise.
The offline check covers unique IDs, coordinate bounds, importance tiers and
known station identities.

The live scraper reads Správa železnic's public station board,
[Infotabule](https://www.spravazeleznic.cz/cestujici/infotabule), with one request
per board using the CIS code (`?station=5457076`). The page carries arrivals and
departures together and omits its board when the request has no `User-Agent`.
Stations without electronic passenger information return an empty board. No
secrets or bindings are required. The page is undocumented. GRAPP's responses
include a notice requiring the owner's consent for data reuse; public availability
does not establish an open-data license.

Czech metro (`CZM`) and light (`CZL`) stops are curated separately from the rail
import. Prague metro stop order and station locations were checked against the
PID feed for 21 November–4 December 2026. Muzeum, Můstek and Florenc each have one
ID shared by the two lines. Colors and service periods come from the same feed.
Track follows the full-length passenger trip in catalog order on each line
(`L991V2`, `L992V2`, `L993V2`), rounded to five decimal places from ROPID's
published coordinates. [PID GTFS](https://data.pid.cz/PID_GTFS.zip) · [PID open data and attribution](https://pid.cz/en/opendata/)

Flora remains on the permanent line A route. Trains pass through during renovation.
DPP expects the station to remain closed through February 2027. [DPP renovation update](https://www.dpp.cz/spolecnost/pro-media/tiskove-zpravy/detail/278_3418-modernizace-stanic-metra-flora-a-hradcanska-ve-druhe-polovine-letosniho-roku)

Liberec–Jablonec tram 11 follows OpenStreetMap's Viadukt–Tyršovy sady track.
The regional authority IDOL confirms all 23 stops and their order. Service hours
use the first and last departures from either outer terminus. Headways use gaps
between successive trams in each direction at Vratislavická Kyselka during
21–27 November 2026. The most common interval is 15 minutes. [OSM route](https://www.openstreetmap.org/relation/2468634) · [IDOL route and timetable](https://dopravnimapy.kraj-lbc.cz/app/idol/linka_detail.php?linka=545011) · [IDOL stop timetable](https://dopravnimapy.kraj-lbc.cz/app/idol/zastavka_prijezd_odjezd.php?datum=2026-11-23&id=51654)

### `stationsGeoJSON`

A typed GeoJSON `FeatureCollection<Point, StationProperties>` containing all stations. Each feature has:

- `properties.id` — station ID (e.g., `"IT01700"`), prefixed by country and optionally `M` for metro, `L` for light rail or `F` for freight
- `properties.name` — station name
- `properties.type` — `"rail"`, `"metro"`, `"light"`, or `"freight"`
- `properties.kind` — freight facilities can be `"marshalling"`, `"intermodal"`, or `"port"`
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
getCountry("HU5510033"); // "hu"
getCountry("CZ5457076"); // "cz"
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
  type: "rail" | "metro" | "light" | "freight";
  kind?: FreightKind;
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
  type: "rail" | "metro" | "light" | "freight";
  kind?: FreightKind;
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
  operatorTypes: OperatorType[]; // "passenger" | "freight" | "metro" | "light-rail"
  bounds: [number, number, number, number]; // [west, south, east, north]
  description: string;
  website: string;
  founded: number | null;
  headquarters: string | null;
  networkKm: number | null;
  annualPassengers: number | null;
  serviceTypes: ServiceType[]; // "high-speed" | "intercity" | "regional" | "commuter" | "night-train" | "international" | "scenic" | "intermodal" | "wagonload" | "block-train"
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
