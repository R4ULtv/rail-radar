export const env = {
  apiUrl: (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, ""),
  mapboxToken: import.meta.env.VITE_MAPBOX_TOKEN ?? "",
  siteUrl: import.meta.env.VITE_SITE_URL || "https://www.railradar24.com",
  posthogKey: import.meta.env.VITE_POSTHOG_KEY ?? "",
} as const;
