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

Curated station photos live in the EU R2 bucket named `rail-radar`. The web Worker validates each
station manifest, rate-limits generated and R2-backed image delivery, streams image objects without
buffering them, and caches responses at the edge. Generated images and R2-backed files use the
`/media/*` namespace.
The same-origin endpoints are:

```text
GET /media/og?id={stationId}
GET /media/stations/{stationId}/photos
GET /media/stations/{stationId}/photo/{image-key}.webp
```

Station manifests are requested by the browser after hydration and are never read while station
pages are prerendered. The Vite development server connects to the real bucket so photos remain
testable locally; production builds keep the R2 binding local, and deployed Workers use the bound
`rail-radar` bucket.

R2 object keys must use this layout:

```text
stations/{stationId}/manifest.json
stations/{stationId}/{image-key}.webp
```

### Station photo requirements

- Format: WebP.
- Size: `1920x1080` with a `16:9` aspect ratio.
- Use lowercase, descriptive, URL-safe keys such as `front.webp` or `platforms.webp`.
- Upload images with the `image/webp` content type.
- Only upload images with a known license or permission suitable for Rail Radar.
- Image keys may contain letters, numbers, `/`, `_`, and `-`, must include a supported image
  extension, and must not contain `..` or `//`.

Copy [station-photo-manifest.template.json](./station-photo-manifest.template.json) and replace its
station id, image metadata, alt text, and attribution. Images are displayed in manifest order after
the generated Mapbox image.

Upload images first, followed by the manifest:

```bash
pnpm --filter=web exec wrangler r2 object put rail-radar/stations/IT1728/front.webp \
  --file /absolute/path/to/front.webp \
  --content-type image/webp \
  --cache-control "public, max-age=31536000, immutable" \
  --remote \
  --jurisdiction eu

pnpm --filter=web exec wrangler r2 object put rail-radar/stations/IT1728/manifest.json \
  --file /absolute/path/to/manifest.json \
  --content-type application/json \
  --cache-control "public, max-age=43200" \
  --remote \
  --jurisdiction eu
```

Manifest responses are cached for 12 hours. Image responses are immutable for one year. Purge the
Cloudflare cache if a manifest must change before its normal expiry.

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
