function publicValue(name: keyof ImportMetaEnv): string {
  return import.meta.env[name] ?? "";
}

export const env = {
  apiUrl: publicValue("VITE_API_URL").replace(/\/$/, ""),
  mapboxToken: publicValue("VITE_MAPBOX_TOKEN"),
  siteUrl: publicValue("VITE_SITE_URL") || "https://www.railradar24.com",
  posthogKey: publicValue("VITE_POSTHOG_KEY"),
} as const;
