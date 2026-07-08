# Rail Radar Static Assets

Cloudflare Worker for shared Rail Radar media, served from `static.railradar24.com`.

This app is the dedicated home for reusable media that should not be coupled to a specific frontend deployment. It uses Cloudflare Workers Static Assets for small, repo-owned files and an R2 bucket for curated station photos.

## Responsibilities

- Serve small, repo-owned, versioned assets from `public/` through Cloudflare Workers Static Assets.
- Provide a stable shared asset host for the web app, studio, and future clients.
- Keep shared media delivery separate from the Next.js deployment lifecycle.
- Apply browser cache headers for shared assets through `public/_headers`.
- Serve R2-backed station photos alongside repo-owned static assets from the same dedicated media domain.
- Validate station photo manifests before exposing image URLs.
- Keep image delivery cacheable while allowing station photo metadata to refresh on a predictable schedule.

## Asset Strategy

| Asset type                         | Storage               | Examples                                             |
| ---------------------------------- | --------------------- | ---------------------------------------------------- |
| Small, repo-owned, versioned files | Workers Static Assets | flags, operator logos, screenshots, shared UI images |
| Larger, growing media collections  | R2 bucket             | station photos                                       |

This split keeps the deployed frontend small while leaving station-image growth in R2.

## Layout

```text
apps/static/
├── public/
│   ├── _headers/            # Browser cache policy for static files
│   ├── flags/               # Country flags
│   ├── operators/           # Operator and brand logos
│   ├── screenshots/         # Shared product screenshots
│   └── station-icon.png     # Shared map marker image used by the API
├── src/index.ts             # Minimal Hono Worker
├── src/station-photos.ts    # R2-backed station photo manifest and image routes
├── station-photo-manifest.template.json
└── wrangler.jsonc           # Worker, domain, and Static Assets configuration
```

Web-app-specific files such as favicon/app icons and web metadata imagery stay in `apps/web/public` when they are tightly coupled to the web app itself.

## Local Development

```bash
pnpm --filter=static dev
```

The static Worker is configured to use:

- Worker server: `http://127.0.0.1:8788`
- Inspector: `127.0.0.1:9230`

Those ports intentionally differ from the API Worker so both Workers can run locally at the same time.

## Station Photos

Station photos are stored in the EU R2 bucket named `rail-radar`. R2 has object keys rather than real folders, but use this key layout consistently:

```text
stations/{stationId}/manifest.json
stations/{stationId}/{image-key}.webp
```

Example:

```text
stations/IT1728/manifest.json
stations/IT1728/front.webp
stations/IT1728/drone.webp
stations/IT1728/front-2.webp
```

The public API is:

```text
GET /stations/{stationId}/photos
GET /stations/{stationId}/photo/{image-key}.webp
```

The station page always renders the generated Mapbox image first, then the images listed in the manifest order.

### Image Requirements

- Format: WebP.
- Size: `1920x1080`.
- Aspect ratio: `16:9`.
- File naming: lowercase, descriptive, URL-safe keys such as `front.webp`, `platforms.webp`, or `drone.webp`.
- Object key safety: image keys may contain letters, numbers, `/`, `_`, and `-`, must include a file extension, and must not contain `..` or `//`.
- Content type: upload images with `image/webp`.
- Cache policy: upload images with `public, max-age=31536000, immutable`.
- Rights: only upload images that have a known license or permission suitable for Rail Radar.

### Manifest Template

Copy [station-photo-manifest.template.json](./station-photo-manifest.template.json) and replace the station id, image keys, alt text, dimensions, and attribution.

```json
{
  "stationId": "IT1728",
  "images": [
    {
      "key": "front.webp",
      "width": 1920,
      "height": 1080,
      "alt": "Front exterior view of Milano Centrale station",
      "attribution": {
        "author": "Photographer name",
        "license": "CC BY 4.0",
        "origin": "Wikimedia Commons",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Example.jpg"
      }
    }
  ]
}
```

Required fields:

- `stationId`: station id from `packages/data`, for example `IT1728`.
- `images`: ordered list of station photos. The order is the gallery order after the generated map image.
- `key`: image object key relative to `stations/{stationId}/`.
- `width` and `height`: expected to be `1920` and `1080`.
- `alt`: concise description of the visible photo.
- `attribution.author`: photographer or source author.
- `attribution.license`: license label shown in the UI.

Optional attribution fields:

- `origin`: short source label used as the visible link text, for example `Wikimedia Commons`.
- `sourceUrl`: canonical page for the original image.

### Upload Commands

Upload images first, then the manifest:

```bash
pnpm --filter=static exec wrangler r2 object put rail-radar/stations/IT1728/front.webp \
  --file /absolute/path/to/front.webp \
  --content-type image/webp \
  --cache-control "public, max-age=31536000, immutable" \
  --remote \
  --jurisdiction eu

pnpm --filter=static exec wrangler r2 object put rail-radar/stations/IT1728/manifest.json \
  --file /absolute/path/to/manifest.json \
  --content-type application/json \
  --cache-control "public, max-age=43200" \
  --remote \
  --jurisdiction eu
```

### Caching

Manifest responses are cached for 12 hours:

```text
Cache-Control: public, max-age=43200, s-maxage=43200
```

Station photo images are cached as immutable assets for one year:

```text
Cache-Control: public, max-age=31536000, immutable
```

If a manifest needs to change immediately, expect some users and shared caches to see the previous manifest until the cache expires unless the URL or CDN cache is purged.

## Deployment

```bash
pnpm --filter=static deploy
```

Wrangler uploads `public/` as Cloudflare Workers Static Assets during deployment. The production route is configured as `static.railradar24.com` in `wrangler.jsonc`. R2 station photo objects are uploaded separately with `wrangler r2 object put`.

## Type Generation

After changing `wrangler.jsonc`, regenerate Worker bindings:

```bash
pnpm --filter=static cf-typegen
```
