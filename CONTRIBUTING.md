# Contributing to Rail Radar

Thanks for your interest in contributing to Rail Radar. This repository is a `pnpm` + Turborepo monorepo with:

- `apps/web`: the public Next.js frontend
- `apps/api`: the Cloudflare Workers API
- `apps/studio`: the station-data admin tool
- `packages/data`: shared station data and TypeScript types
- `packages/ui`: shared UI components

## Code of Conduct

Please read and follow the [Code of Conduct](./CODE_OF_CONDUCT.md) before contributing.

## Ways to Contribute

- Report bugs with the GitHub bug report template
- Suggest features with the feature request template
- Improve documentation
- Fix bugs or ship enhancements
- Add or correct station data

## Getting Started

### Prerequisites

- Node.js `22` or newer
- `pnpm` `10`

If you use Corepack:

```bash
corepack enable
```

Install dependencies from the repository root:

```bash
pnpm install
```

## Development Workflow

1. Fork the repository and create a branch from `main`
2. Make your changes in a focused branch
3. Run the relevant local checks
4. Open a pull request against `main`

Use descriptive branch names such as `fix/search-empty-state` or `feat/station-stats`.

### Running the Apps

From the repository root:

```bash
pnpm dev
```

That starts the main local development flow for:

- `web` on `localhost:3000`
- `api` with the local Workers dev server

You can also work on individual apps:

```bash
pnpm --filter=web dev
pnpm --filter=api dev
pnpm --filter=studio dev
```

## Quality Checks

Before opening a pull request, run the checks relevant to your change:

```bash
pnpm lint --force
pnpm check-types --force
pnpm build
```

If you are working in a single package or app, targeted commands are also welcome while iterating:

```bash
pnpm --filter=web build
pnpm --filter=api cf-typegen
```

CI currently validates linting and type checking on pull requests, so keeping your branch green locally will make review smoother.

## Station Data Contributions

Station data lives in [`packages/data/src/stations.geojson`](./packages/data/src/stations.geojson). For most station-data changes, the easiest workflow is through [Rail Radar Studio](./apps/studio):

```bash
pnpm --filter=studio dev
```

You can use Studio to:

- add missing coordinates
- rename stations
- merge or remove duplicates
- create or delete stations

The Studio README has more detail: [apps/studio/README.md](./apps/studio/README.md).

If your pull request changes `stations.geojson`, GitHub Actions will run an additional validation step and post a summary on the PR.

## Pull Request Guidelines

- Keep pull requests focused and easy to review
- Link related issues when applicable
- Describe the user-facing impact of the change
- Include screenshots or recordings for UI changes
- Mention any new environment variables, config changes, or follow-up work
- Make sure CI passes before requesting review

Small, well-scoped pull requests are much easier to review and merge than large mixed changes.

## Commit Messages

There is no strict commit-message convention, but clear and descriptive messages help a lot. A good format is:

```text
scope: short summary
```

Examples:

```text
web: improve station search empty state
api: handle missing operator logos
data: fix coordinates for Roma Tuscolana
```

## Questions

If you are not sure where to start, open an issue first so we can align on approach and scope before you invest time in implementation.
