# Rail Radar

A real-time Italian railway tracking application featuring an interactive map interface and live train information powered by official RFI data.

## Overview

Rail Radar is a full-stack TypeScript monorepo that provides real-time train arrivals and departures for Italian railway stations. The application combines a Cloudflare Workers API backend with a Next.js frontend featuring an interactive MapLibre GL map.

## Features

- **Interactive Map** - Full-screen map with dark theme, zoom controls, and user geolocation
- **Real-time Train Data** - Live arrivals and departures scraped from official RFI sources
- **1600+ Stations** - Comprehensive coverage of Italian railway stations
- **User Location** - Automatic geolocation with animated position marker
- **Responsive Design** - Mobile-friendly interface with accessible controls

## Tech Stack

### Frontend (apps/web)
- **Next.js 16** with React 19
- **MapLibre GL** via react-map-gl for mapping
- **Tailwind CSS v4** for styling
- **shadcn/ui** component library
- **Lucide** icons

### Backend (apps/api)
- **Cloudflare Workers** for serverless deployment
- **Hono** lightweight web framework
- **Cheerio** for HTML parsing

### Shared
- **TypeScript** with strict mode
- **Turborepo** for monorepo orchestration
- **pnpm** workspaces

## Project Structure

```
rail-radar/
├── apps/
│   ├── api/                    # Cloudflare Workers API
│   │   └── src/
│   │       ├── index.ts        # API routes
│   │       └── scraper.ts      # RFI data scraper
│   └── web/                    # Next.js frontend
│       ├── app/                # App router pages
│       ├── components/
│       │   ├── map.tsx         # Map component
│       │   ├── map-controls.tsx # Zoom, locate, compass
│       │   └── ui/             # UI components
│       └── lib/                # Utilities
├── packages/
│   ├── data/                   # Shared station data & types
│   ├── eslint-config/          # ESLint configurations
│   └── typescript-config/      # TypeScript configurations
└── turbo.json                  # Turbo configuration
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 10

### Installation

```bash
# Clone the repository
git clone https://github.com/R4ULtv/rail-radar.git
cd rail-radar

# Install dependencies
pnpm install
```

### Development

```bash
# Run all apps in development mode
pnpm dev

# Run specific app
pnpm dev --filter=web
pnpm dev --filter=api
```

### Build

```bash
# Build all packages
pnpm build

# Type check
pnpm check-types

# Lint
pnpm lint

# Format
pnpm format
```

### Deployment

```bash
# Deploy API to Cloudflare Workers
cd apps/api
pnpm deploy
```

## API Endpoints

### GET /stations
Returns all stations or filter by query.

```bash
# Get all stations
curl https://api.example.com/stations

# Search stations
curl https://api.example.com/stations?q=roma
```

### GET /trains/:stationId
Returns train arrivals/departures for a station.

```bash
# Get trains (defaults to departures)
curl https://api.example.com/trains/1234

# Get arrivals
curl https://api.example.com/trains/1234?type=arrivals
```

**Response:**
```json
{
  "brand": "Trenitalia",
  "category": "REG",
  "trainNumber": "12345",
  "origin": "Roma Termini",
  "destination": "Milano Centrale",
  "scheduledTime": "14:30",
  "delay": 5,
  "platform": "3",
  "status": "departing",
  "info": "Stops at: Firenze, Bologna"
}
```

## Data Types

```typescript
interface Station {
  id: number
  name: string
  lat?: number
  lon?: number
}

interface Train {
  brand: string | null
  category: string | null
  trainNumber: string
  origin?: string
  destination?: string
  scheduledTime: string
  delay: number | null
  platform: string | null
  status: "incoming" | "departing" | "cancelled" | null
  info: string | null
}
```

## Package Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Start development servers |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format code with Prettier |
| `pnpm check-types` | Run TypeScript type checking |

### Adding Dependencies

```bash
# Add to web app
pnpm add <package> --filter=web

# Add to api app
pnpm add <package> --filter=api

# Add to data package
pnpm add <package> --filter=@repo/data
```

## Configuration

### Environment Variables

The API uses Cloudflare Workers environment bindings configured in `wrangler.jsonc`.

### Map Style

The web app uses Stadia Maps' Alidade Smooth Dark theme. The style URL can be changed in `apps/web/components/map.tsx`.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Train data sourced from [RFI](https://www.rfi.it/) (Rete Ferroviaria Italiana)
- Map tiles by [Stadia Maps](https://stadiamaps.com/)
- Map rendering by [MapLibre](https://maplibre.org/)
