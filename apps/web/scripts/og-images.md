# Station OG images

One image per station, one inventory, all under `og/` in the existing EU `rail-radar` R2 bucket:

```text
og/inventory.json
og/stations/IT1728.webp
og/stations/IT2416.webp
```

The inventory contains only station IDs mapped to their current input hashes:

```json
{
  "IT1728": "<sha256-of-rendering-inputs>",
  "IT2416": "<sha256-of-rendering-inputs>"
}
```

A changed station overwrites its existing image. There are no image generations, country shards or per-station pointer files to maintain.

## Commands

Run from the repository root. The default selection is **importance 1 only** (currently 49 stations):

```sh
pnpm og status                         # See current, missing and outdated images
pnpm og sync                           # Generate/upload only missing or changed level 1 images
pnpm og sync --id IT1728                # Add/update one station, regardless of importance
pnpm og sync --id IT1728 --force        # Refresh its map and render even if inputs are unchanged
pnpm og sync --level 2                  # Explicitly select importance 2
pnpm og sync --all --dry-run            # Preview the full-catalog plan without any writes
pnpm og sync --all                      # Explicitly expand to all stations
```

`--id` can be repeated or comma-separated. `--concurrency` defaults to 3 (maximum 8). `--force` applies only to the selection; include `--id` to refresh one station.

For a separate local review step:

```sh
pnpm og generate                       # Render locally, without accessing R2
pnpm og upload                         # Upload matching local files; no rendering or Mapbox calls
```

`upload` compares validated local image bytes with R2, so `generate --id IT1728 --force` followed by `upload --id IT1728` publishes a reviewed map refresh even when the input hash is unchanged. Identical bytes are skipped.

No generation runs automatically during a web build or deployment.

## Incremental updates

The version hash covers only what affects the image: station ID, normalized name, type, coordinates, country label/flag, template, marker artwork, fonts and the installed Takumi version. Importance and whitespace-only name changes do not regenerate it.

Sync skips an image when its inventory version matches and its R2 object exists. Otherwise it reuses a matching local render or generates a replacement, verifies the upload checksum, then updates that station's inventory entry. The inventory is published after successful uploads; failures retain their previous entries. Rerunning resumes from the local cache. If an image was uploaded before an interrupted inventory update, its R2 ETag avoids uploading the same bytes again.

Local files live in the ignored `apps/web/.og-cache/` directory:

- `images/IT1728.webp` and `images/IT1728.json` — one local render and its version/checksum.
- `maps/` — cached map downloads; a renamed station can reuse its map.
- `inventory.json` — a local copy of the remote ID-to-version inventory, refreshed by `status`.
- `inventory.csv` — readable status, station names, versions, sizes and R2 keys.
- `status.json` — the same detailed status report for scripts.

Use `--force` to refresh a station after an upstream map/style change. Upstream Mapbox content is not polled automatically; changing `MAP_REVISION` in `og-render.tsx` also invalidates the selected images' maps.

Run one sync at a time across machines. A local lock prevents overlapping commands in the same checkout; after a hard crash, check the PID in `.og-cache/sync.lock` before removing a stale lock.

## Serving

GET and HEAD requests use the existing per-IP `RATE_LIMITER` before accessing the cache or R2. Blocked requests return an uncached `429` with `Retry-After: 10`.

`/media/og?id=IT1728` reads `og/stations/IT1728.webp` directly. Browser and edge caches retain existing images for **one day** (`max-age=86400, s-maxage=86400`). Replacements can therefore take up to a day to appear; there are no cache-version parameters or purge steps.

A station without an uploaded image redirects to the shared `/assets/social/og-image.webp` card. This redirect is cached for **one hour** (`max-age=3600, s-maxage=3600`), allowing newly uploaded station images to be discovered sooner. The Worker never downloads the inventory, renders an image or calls Mapbox. HEAD uses R2 metadata and cannot cache an empty GET body. ETag conditional requests are supported.

The serving code needs one deployment to replace the previous dynamic route. Subsequent image additions/replacements need no deployment.

## Setup and checks

Generation uses `MAPBOX_SERVER_TOKEN` from `apps/web/.env` or the environment. Status/upload do not use Mapbox. Both Cloudflare CLIs need access to the target bucket: listings/uploads use `cf`; the installed cf beta.18 drops the EU jurisdiction header on raw object downloads, so the installed Wrangler downloads the inventory. `--bucket` and `--jurisdiction` override the defaults.

```sh
pnpm --filter web test:og
pnpm --filter web check-types
```
