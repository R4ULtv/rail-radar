import { createFactory } from "hono/factory";

export type Bindings = {
  RATE_LIMITER: RateLimit;
  STATION_ANALYTICS: AnalyticsEngineDataset;
  PROVIDER_ANALYTICS: AnalyticsEngineDataset;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  NS_API_KEY: string;
  LDBWS_API_KEY: string;
  TRAFIKLAB_KEY: string;
  REJSEPLANEN_API_KEY: string;
  PLK_API_KEY: string;
  MAPBOX_TOKEN: string;
};

export type Variables = {
  clientIp: string;
};

export type Env = {
  Bindings: Bindings;
  Variables: Variables;
};

export const factory = createFactory<Env>();
