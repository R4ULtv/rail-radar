# Rail Radar Web

Next.js frontend for real-time Italian railway tracking with an interactive map interface.

## Tech Stack

- [Next.js 16](https://nextjs.org/) + React 19
- [MapBox GL](https://www.mapbox.com/mapbox-gljs) via react-map-gl - Interactive mapping
- [SWR](https://swr.vercel.app/) - Data fetching with auto-refresh
- [nuqs](https://nuqs.47ng.com/) - URL query state sync
- [Tailwind CSS v4](https://tailwindcss.com/) - Styling
- [Base UI](https://base-ui.com/) - Component primitives

## Features

- Interactive full-screen map with 2400+ station markers
- Real-time train arrivals/departures with 30s polling
- Fuzzy station search with keyboard shortcuts
- URL-synced map state for shareable links
- User geolocation with animated marker
- Responsive design for mobile and desktop

## Environment Variables

| Variable               | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL`  | API endpoint URL (e.g., `https://api.railradar24.com`) |
| `NEXT_PUBLIC_SITE_URL` | Website URL (e.g., `https://www.railradar24.com`)      |

## Development

```bash
# Install dependencies
pnpm install

# Start development server (localhost:3000)
pnpm dev --filter=web
```

## Project Structure

```
apps/web/
├── app/                    # Next.js App Router
├── components/
│   ├── map.tsx             # Main map component
│   ├── map-controls.tsx    # Zoom, locate, compass controls
│   ├── map-loading.tsx     # Map loading skeleton
│   ├── search.tsx          # Station search
│   ├── static-map.tsx      # Static Mapbox image component
│   ├── station-info.tsx    # Station details drawer
│   ├── station-markers.tsx # GeoJSON marker layer
│   ├── train-row.tsx       # Train list item
│   ├── brands/             # Train brand logos
│   └── station-page/       # Station detail page components
│       ├── nearby-stations.tsx
│       ├── station-header.tsx
│       ├── station-stats.tsx
│       ├── train-board.tsx
│       └── train-column.tsx
└── lib/
    └── api/                # API client and types
```

## Deployment

Deploy to [Vercel](https://vercel.com) or any platform that supports Next.js.

```bash
pnpm build
```
