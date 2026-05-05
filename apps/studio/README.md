# Rail Radar Studio

Admin tool for managing railway station data across Europe. Add missing coordinates, fix station names, create stations, and identify duplicates — then ship the changes back as a pull request.

## Tech Stack

- SvelteKit 2 + Svelte 5 (runes)
- MapLibre GL (interactive map)
- Tailwind CSS 4 + shadcn-svelte / bits-ui
- Wikidata + Wikipedia for station enrichment
- Cloudflare adapter for deployment, file-system API for local edits

## Getting Started

For development with hot-reload:

```bash
pnpm --filter=studio dev
```

Runs on [http://localhost:3001](http://localhost:3001).

The dev script sets `PUBLIC_STUDIO_LOCAL_MODE=true` and `LOCAL_ENV=true`, which enables the local file API (`/api/stations`) so edits are written straight to `packages/data/src/stations.geojson`.

For a production build:

```bash
pnpm --filter=studio build
pnpm --filter=studio preview
```

## Modes

**Local mode** — used during development. Reads and writes `packages/data/src/stations.geojson` directly through the SvelteKit endpoints under `/api/stations`. Every edit is persisted to disk immediately.

**Browser mode** — used in the deployed build. Upload a GeoJSON file, edit in-browser, and export the result. Nothing is written server-side.

The mode is selected automatically based on `PUBLIC_STUDIO_LOCAL_MODE`, `LOCAL_ENV`, or `STUDIO_LOCAL_MODE`.

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
