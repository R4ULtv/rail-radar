/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_POSTHOG_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "virtual:nearby-stations" {
  const ids: import("./lib/nearby-stations").NearbyStationIds;
  export default ids;
}
