# Rail Radar Studio

Admin tool for managing railway station data across Italy and Switzerland. Add missing coordinates, fix station names, and identify duplicates.

## Tech Stack

- Next.js 16 + React 19
- MapLibre GL (interactive map)
- Sonner (toast notifications)
- localStorage for session persistence

## Getting Started

For contribution work, build and run the production version:

```bash
pnpm --filter=studio build
pnpm --filter=studio start
```

For development with hot-reload:

```bash
pnpm dev --filter=studio
```

Runs on [http://localhost:3001](http://localhost:3001)

## Features

- Interactive map with 4500+ stations
- Station search and filtering (All / Missing coordinates / Duplicates)
- Click-to-place coordinates for stations missing location
- Drag markers to fine-tune positions
- Edit station names
- Add new stations
- Delete stations
- **Contribution tracking with auto-generated PRs**

## How to Contribute Changes

### Making Changes

1. Open the studio at `localhost:3001`
2. Browse stations via sidebar (use tabs: All, Missing, Duplicates)
3. Make changes:
   - **Add coordinates**: Select station → Click on map to set location
   - **Move station**: Drag the marker to correct position
   - **Rename station**: Edit name in the side panel
   - **Add new station**: Click "Add Station" → Click on map
   - **Delete station**: Open edit panel → Click delete

### Reviewing Your Changes

1. Changes are tracked automatically (green banner appears)
2. Click "Review" to open the contribution panel
3. See all your changes with statistics:
   - Coordinates added/updated
   - Stations renamed/created/deleted
   - Coverage % change

### Submitting a Pull Request

1. In the contribution panel, review the auto-generated PR content
2. Click "Open in GitHub" button
3. GitHub opens with pre-filled PR title and description
4. Create a new branch with the auto-suggested name (format: `studio/YYYY-MM-DD-description`)
5. Commit your changes and submit the PR

**Note**: Changes are saved to localStorage, so you can close the browser and continue later.

### Clearing Your Session

- Click "Clear Session" in the contribution panel to start fresh
- This removes all tracked changes from localStorage

## Data Files

Station data is managed in `packages/data/src/stations.json`.
