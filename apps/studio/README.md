# Rail Radar Studio

Admin tool for managing railway stations, transit lines and railway operators across Europe. Use the Stations, Lines and Operators workspaces to curate the shared datasets.

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

The dev script automatically selects local mode and enables the custom Vite middleware that serves `/api/stations` from the development server.

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

`pnpm --filter=studio dev` selects local mode through SvelteKit's development flag. The middleware runs only in the Vite development server; it does not use SvelteKit server routing and is unavailable in preview, production, and browser mode.

## Features

- Interactive map with all stations and freight yards, filterable by type (rail / metro / light / freight), importance and duplicates
- Sidebar search and filtering
- Drag markers to fine-tune coordinates
- Edit station name, type and importance, plus freight yard kind (marshalling / intermodal / port)
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
   - **Add** — click "Add Station", click on the map, choose an ID and type. Freight yards also have an optional yard kind; the Yards filter preselects the freight type.
   - **Delete** — open the edit panel and click delete.
3. Use the Wikipedia panel to pull suggested coordinates from Wikidata when a station is missing them.
4. Click **Review** to open the contribution panel and see a summary of every change.

## Submitting Changes

1. Open the contribution panel.
2. Review the auto-generated PR title and description.
3. Click **Open in GitHub** — GitHub opens with the body pre-filled.
4. Create a branch (suggested format: `studio/YYYY-MM-DD-description`), commit, and open the PR.

Station history and contribution summaries are persisted to `localStorage`. In browser mode,
export your edited dataset before leaving to keep the actual data changes.

## Operators

Open **Operators** in the workspace navigation, or visit `/operators`.

- Search by name, slug or country; filter by country and operator type, including freight.
- Create and edit passenger, freight, metro and light rail profiles, including operators with multiple types.
- Edit every profile field: identity, logo asset path, countries, services, description, website,
  network bounds, company details, statistics and external links. Empty optional statistics
  are saved as `null`, so freight operators do not need passenger totals.
- Local mode previews logos directly from `apps/web/public/assets/operators`; browser mode
  uses the website's published assets. Missing artwork uses a placeholder. This editor references
  SVG files; add or replace the artwork in the repository separately.
- **Save operator** writes to `packages/data/src/operators.json` in local development.
  Writes are atomic, preserve editorial order and untouched profiles, and reject stale or
  competing edits. Reload after external data changes.
- Operators assigned to saved lines cannot be renamed or deleted until those line assignments
  are changed in the Lines workspace. Browser mode checks against the bundled lines.
- In browser mode, the workspace starts from the bundled operators. Saves stay in memory;
  **Not exported** remains visible until you export `operators.json`. Importing a JSON file
  switches to browser editing even during local development, so it never overwrites the local file.
- Unsaved drafts and unexported browser changes prompt before they are discarded. Use
  `⌘K` / `Ctrl+K` to search, arrow keys or Home/End to browse, `⌘S` / `Ctrl+S` to save,
  and Escape to close the editor outside a text field.

Operator imports and edits validate slugs, duplicates, supported countries/types/services,
URLs, bounds and numeric values. Unknown fields are rejected instead of silently removed.
The legacy missing parent-company value is treated as unknown (`null`) when loaded.
Run the Studio regression tests with `pnpm --filter=studio test`.

## Transit lines

Open **Lines** in the workspace navigation, or visit `/lines`.

- Browse all lines on the map; search by line, operator or station, and filter metro/light rail.
- Lines and unlinked stations use the Stations sidebar pattern, with virtualized rows, shared ScrollArea, and truncated names. Use arrow keys, Home/End to navigate, or `⌘K` / `Ctrl+K` to search.
- Select a line to edit its ID, name, description, public code, operator slug, type and color (`#RRGGBB`, typed or picked). Press `Esc` to close the station card, then the editor.
- Routes are numbered branches. Select one to see its start, finish and full ordered stop list. Add existing stations, reorder/remove stops, and add/remove branches. A stop can appear again for rings and loops, but not twice in a row. A route that runs within another (a short trip) is rejected on save. Stations may belong to multiple lines and routes.
- Each line has one track for all its routes. In local mode, edit it as GeoJSON `MultiLineString` with **Edit geometry**, then **Apply geometry**. Stop edits do not automatically redraw the track.
- **Unlinked** lists existing metro/light stations in covered countries that have no saved line assignment. Select one and add it to the selected route, or use the editor's station search.
- Create or delete lines, import `lines.json`, and export the complete dataset.
- Routes list only open stops. When a station under construction opens, add it to its
  route from **Unlinked** or the editor's station search.

In local development, **Save line** writes atomically to `packages/data/src/lines.json`
and the line's track to `packages/data/src/lines/<line-id>.json` through the local-only
`/api/lines` middleware. Renaming a line moves its track file; deleting a line removes it.
Unknown station IDs, duplicate line IDs, short trips, malformed geometry, unsupported
fields and conflicting on-disk edits are rejected. Reload to pick up external changes.
Station names and positions are read from `stations.geojson`, never copied into lines.
Review writes with `git diff`. Stations used by a line cannot be deleted from the Stations
workspace until their references are removed from the line's routes. In browser mode the
check uses the bundled lines.

In browser mode, the workspace starts with the bundled datasets and loads each line's
track file. Saves stay in memory and the header shows **Not exported** until you export `lines.json`;
leaving, reloading or importing asks first. Track
edits and line renames need local mode, since the export contains only `lines.json`, so
the Line ID of a saved line is locked there.
Importing a lines file also switches to browser editing, including during local
development. Unsaved draft changes prompt before switching lines or leaving the workspace.

## Station data

Station data lives in `packages/data/src/stations.geojson` and is shared with the rest of the monorepo via `@repo/data`.

Freight yards use `type: "freight"` and an optional `kind` of `marshalling`, `intermodal`, or
`port`. Create and edit them in the Stations workspace using the Yards filter. Selecting
**Unspecified** clears a yard's kind; changing its type away from freight also clears it.
Kind changes are included in undo/redo and contribution review. Yards are excluded from
the Lines workspace's unlinked transit stops and station search.

GeoJSON, JSON and CSV imports and exports preserve yard kinds. JSON records have an optional
`kind` field; CSV adds an optional `kind` column after `lng`. Older files without kinds remain
supported. Unsupported kinds and kinds on passenger stations are rejected on import.

Studio rounds new and edited coordinates, including JSON and CSV imports, to at most five decimal
places. Coordinate inputs use a `0.00001` step, and the Wikipedia panel and status bar display five
decimal places. Saved and exported numeric coordinates omit trailing zeros.

See the [shared data package](../../packages/data/README.md#transit-lines) for the
line format and lookup APIs.
