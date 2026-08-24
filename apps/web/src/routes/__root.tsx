import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/button";
import { Analytics } from "@/components/analytics";
import { env } from "@/lib/env";
import appCss from "../styles.css?url";

const DEFAULT_TITLE = "Rail Radar | Live Train Tracker Across Europe";
const DEFAULT_DESCRIPTION =
  "Track live train departures, delays, platforms, and arrivals across 18,000+ stations in 12 European countries.";
const DEFAULT_OG_IMAGE = new URL("/assets/social/og-image.webp", env.siteUrl).toString();
const DEFAULT_OG_IMAGE_ALT =
  "Rail Radar live train tracking map for railway stations across Europe";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      },
      { title: DEFAULT_TITLE },
      {
        name: "description",
        content: DEFAULT_DESCRIPTION,
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Rail Radar" },
      { property: "og:title", content: DEFAULT_TITLE },
      { property: "og:description", content: DEFAULT_DESCRIPTION },
      { property: "og:image", content: DEFAULT_OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: DEFAULT_OG_IMAGE_ALT },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: DEFAULT_TITLE },
      { name: "twitter:description", content: DEFAULT_DESCRIPTION },
      { name: "twitter:image", content: DEFAULT_OG_IMAGE },
      { name: "twitter:image:alt", content: DEFAULT_OG_IMAGE_ALT },
      { name: "theme-color", content: "#0c0a09" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Rail Radar" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/icon@180px.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: env.apiUrl, crossOrigin: "anonymous" as const },
      {
        rel: "preconnect",
        href: "https://api.mapbox.com",
        crossOrigin: "anonymous" as const,
      },
      { rel: "alternate", hrefLang: "en", href: "https://www.railradar24.com" },
      { rel: "alternate", hrefLang: "x-default", href: "https://www.railradar24.com" },
    ].filter((link) => !("href" in link) || Boolean(link.href)),
  }),
  notFoundComponent: RootNotFound,
  component: RootDocument,
});

function RootNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-6 text-center">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            404
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Route not found</h1>
          <p className="text-muted-foreground">
            This page doesn&apos;t exist or may have moved. Return to the live map or browse the
            station directory.
          </p>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button nativeButton={false} render={<Link to="/" />}>
            Back to map
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link to="/stations" />}>
            Browse stations
          </Button>
        </div>
      </div>
    </main>
  );
}

function RootDocument() {
  return (
    <html
      lang="en"
      className="dark scheme-only-dark scroll-smooth scroll-pt-8"
      style={{ colorScheme: "dark" }}
      data-scroll-behavior="smooth"
    >
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <Outlet />
        <Analytics />
        <Scripts />
      </body>
    </html>
  );
}
