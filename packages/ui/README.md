# @repo/ui

A comprehensive UI component library built on **Base UI** primitives with modern styling patterns. This package provides 46+ accessible, type-safe components designed for use in a monorepo workspace.

## Architecture

This library uses a **headless component architecture** combining:

- **[@base-ui/react](https://base-ui.com/)** - Headless, unstyled component primitives providing accessibility and behavior
- **[shadcn/ui](https://ui.shadcn.com/) patterns** - Design system patterns and styling conventions (not the component library itself)
- **Tailwind CSS 4** - Modern utility-first CSS with OKLch color space
- **Class Variance Authority** - Type-safe component variants

## Features

- 46+ accessible components built on Base UI primitives
- Full TypeScript support with comprehensive typing
- Tailwind CSS 4 with modern OKLch color space
- Dark mode support via `next-themes`
- Type-safe component variants using CVA
- Custom hooks for common UI patterns
- Workspace package designed for monorepo consumption
- Highly composable component API
- CSS custom properties for theming

## Installation & Usage

This package is designed to be consumed as a workspace package in a pnpm monorepo.

### Importing Components

```tsx
import { Button } from "@repo/ui/components/button";
import { Dialog } from "@repo/ui/components/dialog";
import { Card } from "@repo/ui/components/card";
```

### Importing Hooks

```tsx
import { useIsMobile } from "@repo/ui/hooks/use-is-mobile";
import { useDebounce } from "@repo/ui/hooks/use-debounce";
```

### Importing Utilities

```tsx
import { cn } from "@repo/ui/lib/utils";
```

### Importing Styles

```tsx
import "@repo/ui/styles/globals.css";
```

## Custom Hooks

### useIsMobile

Detects if the viewport is mobile-sized (< 768px).

```tsx
import { useIsMobile } from "@repo/ui/hooks/use-is-mobile";

export function ResponsiveComponent() {
  const isMobile = useIsMobile();

  return <div>{isMobile ? <MobileView /> : <DesktopView />}</div>;
}
```

### useDebounce

Generic debounce hook with configurable delay.

```tsx
import { useDebounce } from "@repo/ui/hooks/use-debounce";
import { useState } from "react";

export function SearchComponent() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Use debouncedSearch for API calls
  return <input value={search} onChange={(e) => setSearch(e.target.value)} />;
}
```

## Utilities

### cn

Combines `clsx` and `tailwind-merge` for safe className merging, preventing Tailwind class conflicts.

```tsx
import { cn } from "@repo/ui/lib/utils";

export function Component({ className }) {
  return <div className={cn("text-sm font-medium", className)}>Content</div>;
}
```

## Development

### Adding New Components

1. Create component file in `src/components/[component-name].tsx`
2. Build on Base UI primitives from `@base-ui/react`
3. Use CVA for variants when needed
4. Export from the component file
5. Add to package.json exports if needed

### Configuration

Component configuration is managed in `components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-vega",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "css": "src/styles/globals.css",
    "baseColor": "stone",
    "cssVariables": true
  },
  "iconLibrary": "lucide"
}
```

## Dependencies

### Production Dependencies

| Package                      | Purpose                                                  |
| ---------------------------- | -------------------------------------------------------- |
| **@base-ui/react**           | Headless component primitives (accessibility & behavior) |
| **tailwindcss**              | Utility-first CSS framework                              |
| **next-themes**              | Theme management (light/dark mode)                       |
| **lucide-react**             | Icon library                                             |
| **class-variance-authority** | Type-safe component variants                             |
| **clsx**                     | Conditional className utility                            |
| **tailwind-merge**           | Merge Tailwind classes without conflicts                 |
| **sonner**                   | Toast notifications                                      |
| **vaul**                     | Drawer primitives                                        |
| **tw-animate-css**           | Custom Tailwind animations                               |

### Key Architecture Decisions

**Why Base UI?**

- Headless architecture separates behavior from presentation
- Production-ready accessibility (ARIA, keyboard navigation, focus management)
- Unstyled primitives allow complete design control
- Smaller bundle size (no opinionated styles)

**Why shadcn patterns?**

- Well-tested component composition patterns
- Modern design system conventions
- Community-standard approach to variants and styling

**Why Tailwind CSS 4?**

- Modern CSS features (container queries, OKLch colors)
- Faster build times with new engine
- Better developer experience

**Component Composition Pattern:**

```tsx
// Base UI provides the primitive
import * as Dialog from "@base-ui/react/Dialog";

// We add styling and variants
export const DialogTitle = ({ className, ...props }) => (
  <Dialog.Title className={cn("text-lg font-semibold", className)} {...props} />
);
```

## Path Aliases

The package uses TypeScript path aliases for cleaner imports:

```json
{
  "@repo/ui/components": "./src/components",
  "@repo/ui/lib": "./src/lib",
  "@repo/ui/hooks": "./src/hooks",
  "@repo/ui/utils": "./src/lib/utils"
}
```
