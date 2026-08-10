# Rail Radar Web

TanStack Start frontend for real-time train tracking across Europe, deployed as a Cloudflare Worker.

## Stack

- TanStack Start and TanStack Router for SSR, file routes, metadata, URL state, and server endpoints
- TanStack Query for search, live train boards, station statistics, and trending-station caching
- React 19
- Mapbox GL through `react-map-gl`
- Tailwind CSS v4, self-hosted Geist WOFF2 fonts, and the shared `@repo/ui` component library
- Wrangler and Cloudflare Workers Static Assets

## Features

- Interactive full-screen map with 21,000+ station markers
- Real-time arrivals and departures with background polling
- Station search with keyboard shortcuts and shareable URL state
- Operator and station directories, station details, static maps, and photo galleries
- Saved and recent stations in local storage
- User geolocation and responsive mobile/desktop layouts
- Prerendered metadata and structured data, plus sitemap, robots, web manifest, and dynamic station Open Graph images

## Environment variables

Copy `.env.example` to `.env` for local development.

| Variable | Visibility | Description |
| --- | --- | --- |
| `VITE_API_URL` | Public | Rail Radar API base URL |
| `VITE_MAPBOX_TOKEN` | Public | Mapbox browser token |
| `VITE_SITE_URL` | Public | Canonical website URL |
| `VITE_STATIC_URL` | Public | Shared static asset origin |
| `VITE_POSTHOG_KEY` | Public | PostHog project key |
| `MAPBOX_SERVER_TOKEN` | Secret | Server-only token for dynamic Open Graph maps |

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
and the checkout-gated donation success page remain request-time SSR routes. The sitemap and Open
Graph image endpoints also remain handled by the Worker. The web manifest and robots file are plain
assets in `public/` and are served directly by Cloudflare Static Assets.

## Validation

```bash
pnpm --filter=web check-types
pnpm --filter=web lint
pnpm --filter=web build
pnpm --filter=web exec wrangler deploy --dry-run
```

## Cloudflare deployment

Authenticate Wrangler, configure the public build variables in the Cloudflare build environment, and store the map token as a Worker secret:

```bash
pnpm --filter=web exec wrangler secret put MAPBOX_SERVER_TOKEN
pnpm --filter=web deploy
```

`wrangler.jsonc` serves `dist/client` as Worker static assets and runs the TanStack Start SSR handler from `dist/server/server.js`.
