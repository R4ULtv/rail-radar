# Rail Radar

Real-time Italian railway tracking with an interactive map interface and live train data.

## Features

- Interactive map with 2400+ Italian railway stations
- Real-time arrivals and departures from official RFI data
- Station search with fuzzy matching
- Shareable URLs with map state
- User geolocation support
- Responsive mobile-friendly design

## Project Structure

| Directory                        | Description                              |
| -------------------------------- | ---------------------------------------- |
| [apps/api](./apps/api)           | Cloudflare Workers API for train data    |
| [apps/studio](./apps/studio)     | Admin tool for station data management   |
| [apps/web](./apps/web)           | Next.js frontend with interactive map    |
| [packages/data](./packages/data) | Shared station data and TypeScript types |

## Quick Start

```bash
# Install dependencies
pnpm install

# Run all apps in development
pnpm dev

# Run specific app
pnpm dev --filter=web    # Frontend at localhost:3000
pnpm dev --filter=api    # API server
pnpm dev --filter=studio # Admin tool at localhost:3001
```

## Scripts

| Command            | Description                  |
| ------------------ | ---------------------------- |
| `pnpm dev`         | Start development servers    |
| `pnpm build`       | Build all packages           |
| `pnpm lint`        | Lint all packages            |
| `pnpm format`      | Format code with Prettier    |
| `pnpm check-types` | Run TypeScript type checking |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Contributing Station Data

To add, edit, or remove train stations, use the [Rail Radar Studio](./apps/studio) tool. It provides an interactive map to:

- Add missing coordinates to stations
- Rename stations and fix typos
- Identify and merge duplicate stations
- Add new stations or remove invalid ones

See [apps/studio/README.md](./apps/studio/README.md) for detailed instructions.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file.

## Acknowledgments

- Train data from [RFI](https://www.rfi.it/) (Rete Ferroviaria Italiana)
- Map tiles by [Stadia Maps](https://stadiamaps.com/)
- Map rendering by [MapLibre](https://maplibre.org/)
