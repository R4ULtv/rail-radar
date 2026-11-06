# Rail Radar Web

TanStack Start frontend for real-time train tracking across Europe, deployed as a Cloudflare Worker.

## Stack

- TanStack Start and TanStack Router for SSR, file routes, metadata, URL state, and server endpoints
- TanStack Query for search, live train boards, station statistics, and trending-station caching
- React 19
- Mapbox GL through `react-map-gl`
- Tailwind CSS v4, self-hosted Geist WOFF2 fonts, and the shared `@repo/ui` component library
- Wrangler, Cloudflare Workers Static Assets, and R2 station photos

## Features

- Interactive full-screen map with 22,000+ station markers
- Real-time arrivals and departures with background polling
- Station search with keyboard shortcuts and shareable URL state
- Operator and station directories, station details, static maps, and photo galleries
- Saved and recent stations in local storage
- User geolocation and responsive mobile/desktop layouts
- Prerendered metadata and structured data, plus sitemap, robots, web manifest, and dynamic station Open Graph images

## Environment variables

Copy `.env.example` to `.env` for local development.

| Variable              | Visibility | Description                                   |
| --------------------- | ---------- | --------------------------------------------- |
| `VITE_API_URL`        | Public     | Rail Radar API base URL                       |
| `VITE_MAPBOX_TOKEN`   | Public     | Mapbox browser token                          |
| `VITE_SITE_URL`       | Public     | Canonical website URL                         |
| `VITE_POSTHOG_KEY`    | Public     | PostHog project key                           |
| `MAPBOX_SERVER_TOKEN` | Secret     | Server-only token for dynamic Open Graph maps |

## Development

```bash
pnpm install
pnpm --filter=web dev
```

The app runs at `http://localhost:3000`.

## Structure

All application code lives under `src/`. Route definitions and their page components live
together in `src/routes` using `createFileRoute`, reusable UI lives in `src/components`, and
application utilities live in `src/hooks` and `src/lib`. Original and site-optimized Geist font
files live in `src/assets/fonts/Geist`; Vite emits only the two optimized files referenced by CSS.

## Rendering

The home, donation, legal, report, operator directory, every operator detail page, and importance
level 1-3 station detail pages are prerendered into `dist/client` during the production build. The
dynamic paths are generated from the local operator and station datasets, so relevant data changes
automatically update the static page set on the next build.

Station directories (`/stations` and `/stations/:country`), importance level 4 station details,
and the checkout-gated donation success page remain request-time SSR routes. The sitemap and
dynamic Open Graph image endpoint also remain handled by the Worker. The web manifest and robots
file are plain assets in `public/` and are served directly by Cloudflare Static Assets.

## Media delivery

Repository-owned media lives under `public/assets/` and is served from `/assets/*` through
Cloudflare Workers Static Assets. Flags, operator logos, product screenshots, map imagery, and
static social images have separate subdirectories there. They are independent files and are not
included in the JavaScript bundle. Their browser cache policies are defined in `public/_headers`.

Only browser-native files remain at the public root: the favicon and app icons, web manifest, and
robots file.

Curated station photos live in the EU R2 bucket named `rail-radar`. Their metadata lives in one
central `stations/inventory.json`, keyed by station ID. Each value is an ordered array of photo
keys, dimensions, alt text, and attribution. The checked-in snapshot is
[`src/data/station-photos.json`](./src/data/station-photos.json).

Station loaders include only that station's photos, so prerendered HTML and hydration data already
contain the gallery. The browser does not fetch a manifest after hydration. The complete catalog
stays in the server bundle, where it also validates allowed image keys. Image bytes still stream
from R2 through the rate-limited, edge-cached media route.

The same-origin endpoints are:

```text
GET /media/og?id={stationId}
GET /media/stations/{stationId}/photos
GET /media/stations/{stationId}/photo/{image-key}.webp
```

For generated station Open Graph cards and their separate inventory, see
[`scripts/og-images.md`](./scripts/og-images.md).

The `/photos` endpoint remains available to older clients and serves the bundled catalog without
accessing R2. Successful responses are cached for 12 hours; missing entries for up to five minutes
at the edge. GET and HEAD are supported. Photo URLs are immutable for one year.

### Catalog workflow

From the repository root:

```bash
pnpm --filter web photos check          # Validate the local snapshot; no Cloudflare access
pnpm --filter web photos sync           # Download and validate the central R2 catalog once
pnpm --filter web photos upload         # Publish the local snapshot to R2 and verify its checksum
```

Pass `--account <account-id>` when Wrangler can access multiple accounts. The commands use the
installed Wrangler and default to bucket `rail-radar`, jurisdiction `eu`. `--bucket` and
`--jurisdiction` override those defaults. Invalid downloads never replace the local snapshot.

Every web build validates the checked-in snapshot, then prerenders from it without remote manifest
reads or Cloudflare credentials. Catalog edits and syncs are explicit: commit the updated snapshot
and rebuild/deploy to change gallery metadata on the website. The snapshot is a normal Turbo build
input, so changing it invalidates the web build cache. R2 is the shared catalog; the committed copy
pins each deployment to the reviewed metadata.

To add or change photos:

1. Prepare and review the images and their attribution.
2. Upload image objects first, using new filenames when replacing cached photos.
3. Update `src/data/station-photos.json` and run `photos check`, then `photos upload`.
4. Commit the snapshot, build, and deploy. Other checkouts can use `photos sync` to get the catalog.

The R2 layout is:

```text
stations/inventory.json
stations/{stationId}/{image-key}.webp
stations/{stationId}/manifest.json      # Legacy: retain for the currently deployed Worker
```

**Compatible rollout:** the existing per-station R2 manifests and image objects remain untouched.
The catalog commands never modify or delete them. Until the catalog-based Worker is deployed,
production continues to read those legacy manifests; maintain them too if publishing another photo
change during that interval. Keep them available for rollback after deployment.

### Station photo requirements

- Format: WebP.
- Size: `1920x1080` with a `16:9` aspect ratio.
- Use lowercase, descriptive, URL-safe keys such as `front.webp` or `platforms.webp`.
- Upload images with the `image/webp` content type.
- Only upload images with a known license or permission suitable for Rail Radar.
- Image keys may contain letters, numbers, `/`, `_`, and `-`, must include a supported image
  extension, and must not contain `..` or `//`.
- Include alt text, positive integer dimensions, author, license, and any source/credit details.
  Source URLs must use HTTPS.

The existing [station-photo-manifest.template.json](./station-photo-manifest.template.json) shows
photo metadata fields; copy its `images` array under the station ID in the central catalog. Images
are displayed in catalog order after the generated Mapbox image.

```bash
pnpm --filter=web exec wrangler r2 object put rail-radar/stations/IT1728/front.webp \
  --file /absolute/path/to/front.webp \
  --content-type image/webp \
  --cache-control "public, max-age=31536000, immutable" \
  --remote \
  --jurisdiction eu
```

Urgent removals require a catalog update and deployment, plus purging the affected static page,
`/photos` response, and immutable image cache entries. Changing the catalog alone does not evict
previously cached image bytes.

## Validation

```bash
pnpm --filter=web check-types
pnpm --filter=web lint
pnpm --filter=web build
pnpm --filter=web cf-typegen
pnpm --filter=web exec wrangler deploy --dry-run
```

## Cloudflare deployment

Authenticate Wrangler, configure the public build variables in the Cloudflare build environment, and store the map token as a Worker secret:

```bash
pnpm --filter=web exec wrangler secret put MAPBOX_SERVER_TOKEN
pnpm --filter=web deploy
```

The Cloudflare Vite plugin builds the TanStack Start SSR handler and deploys the client output as
Worker static assets. `wrangler.jsonc` also binds the R2 bucket and media rate limiter.
Regenerate `worker-configuration.d.ts` with `pnpm --filter=web cf-typegen` whenever those bindings
change.

## Preview deployment

Worker Previews use the production custom domain as their base and do not expose `workers.dev`
URLs. Workers Builds deploys the `preview` branch automatically. To deploy by hand from the
`preview` branch, build first, because `deploy:preview` only deploys the existing `dist`:

```bash
pnpm --filter=web build
pnpm --filter=web deploy:preview
```

Wrangler defaults the Preview name to the current Git branch, so the `preview` branch is always
available at `https://preview.railradar24.com`; other branches are served at
`https://<branch>.railradar24.com`. Previews do not inherit production bindings or secrets: the
`previews` block shares the read-only station-photo R2 bucket with production and uses its own
rate-limit namespace. Store the map token for all Previews once with:

```bash
pnpm --filter=web exec wrangler preview base-config secret put MAPBOX_SERVER_TOKEN
```

The custom-domain Preview setting must first be applied by a production deployment from a clean
checkout of the production branch. Once that one-time deployment has completed, Preview deployments
update only the isolated branch environment.
