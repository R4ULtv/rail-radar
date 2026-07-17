# Rail Radar Studio

Admin tool for managing railway station data across Europe. Add missing coordinates, fix station names, create stations, and identify duplicates — then ship the changes back as a pull request.

## Tech Stack

- SvelteKit 2 + Svelte 5 (runes)
- MapLibre GL (interactive map)
- Tailwind CSS 4 + shadcn-svelte / bits-ui
- Wikidata + Wikipedia for station enrichment
- Cloudflare adapter for deployment, custom Vite middleware for local edits

## Getting Started

For development with hot-reload:

```bash
pnpm --filter=studio dev
```

Runs on [http://localhost:3001](http://localhost:3001).

The dev script sets `PUBLIC_STUDIO_LOCAL_MODE=true` and `LOCAL_ENV=true`. These flags select local mode in the app and enable the custom Vite middleware that serves `/api/stations` from the development server.

For a production build:

```bash
pnpm --filter=studio build
pnpm --filter=studio preview
```

## Environment variables

| Variable             | Description                                                                       |
| -------------------- | --------------------------------------------------------------------------------- |
| `PUBLIC_POSTHOG_KEY` | PostHog project API key (EU cloud); events are proxied through t.railradar24.com. |

## Modes

**Local mode** — used during development. The custom `localStationApi` Vite plugin installs dev-server middleware under `/api/stations`. Its write operations modify `packages/data/src/stations.geojson` directly, so use `git diff` to review the data changes and run the repository's existing format, lint, and type-check workflow before committing them.

**Browser mode** — used in preview and production builds. Upload a GeoJSON file, edit in-browser, and export the result. Nothing is written server-side.

`pnpm --filter=studio dev` enables local mode through `PUBLIC_STUDIO_LOCAL_MODE=true` and `LOCAL_ENV=true`. The middleware also recognizes `STUDIO_LOCAL_MODE=true`, but it runs only in the Vite development server; it does not use SvelteKit server routing and is unavailable in preview, production, and browser mode.

## Features

- Interactive map with all stations, filterable by type (rail / metro / light) and country
- Sidebar search and filtering
- Drag markers to fine-tune coordinates
- Edit station name, type, and importance
- Create new stations by clicking the map, with ID validation:
  - 2-3 letter country prefix + 3+ digits (typically 6-8)
  - duplicate-ID detection with the conflicting station's name
  - hint when the entered prefix doesn't match any existing country
- Delete and restore stations
- Undo / redo (`⌘Z` / `⌘⇧Z`) with labelled history
- Wikipedia / Wikidata enrichment for any country (language-agnostic via Wikidata; richer infobox parsing for Italian stations)
- Contribution tracking with auto-generated pull-request content

## Editing Workflow

1. Browse stations via the sidebar or click a marker.
2. Make changes:
   - **Move** — drag the marker.
   - **Rename / retype** — edit the side panel and save.
   - **Add** — click "Add Station", click on the map, choose an ID.
   - **Delete** — open the edit panel and click delete.
3. Use the Wikipedia panel to pull suggested coordinates from Wikidata when a station is missing them.
4. Click **Review** to open the contribution panel and see a summary of every change.

## Submitting Changes

1. Open the contribution panel.
2. Review the auto-generated PR title and description.
3. Click **Open in GitHub** — GitHub opens with the body pre-filled.
4. Create a branch (suggested format: `studio/YYYY-MM-DD-description`), commit, and open the PR.

Changes are persisted to `localStorage`, so closing the tab won't lose work.

## Data

Station data lives in `packages/data/src/stations.geojson` and is shared with the rest of the monorepo via `@repo/data`.
