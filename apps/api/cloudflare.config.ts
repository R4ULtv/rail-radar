import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig({
  worker: {
    name: "rail-radar-api",
    compatibilityDate: "2026-09-08",
    entrypoint: "src/index.ts",
    limits: {
      cpuMs: 100,
    },
    observability: {
      enabled: true,
      issues: {
        enabled: true,
      },
      headSamplingRate: 1,
      traces: {
        enabled: true,
        headSamplingRate: 0.2,
      },
    },
    assets: {
      runWorkerFirst: true,
    },
    domains: ["api.railradar24.com"],
    triggers: [
      // One synthetic departures request per provider (see src/provider-probes.ts). Hourly gives
      // 24 a day, so a provider with no visitor traffic still has health in the 24-hour window.
      triggers.scheduled({ schedule: "0 * * * *" }),
    ],
    env: {
      CLOUDFLARE_ACCOUNT_ID: bindings.secret(),
      CLOUDFLARE_API_TOKEN: bindings.secret(),
      IP_HASH_PEPPER: bindings.secret(),
      MAPBOX_TOKEN: bindings.secret(),
      DB_CLIENT_ID: bindings.secret(),
      DB_API_KEY: bindings.secret(),
      NS_API_KEY: bindings.secret(),
      LDBWS_API_KEY: bindings.secret(),
      TRAFIKLAB_KEY: bindings.secret(),
      REJSEPLANEN_API_KEY: bindings.secret(),
      PLK_API_KEY: bindings.secret(),
      SNCF_API_KEY: bindings.secret(),
      MOBILITEIT_API_KEY: bindings.secret(),
      STATION_ANALYTICS: bindings.analyticsEngineDataset({
        name: "station_visits",
      }),
      PROVIDER_ANALYTICS: bindings.analyticsEngineDataset({
        name: "provider_metrics",
      }),
      RATE_LIMITER: bindings.rateLimit({
        namespace: "1001",
        simple: {
          limit: 15,
          period: 10,
        },
      }),
      STATION_RATE_LIMITER: bindings.rateLimit({
        namespace: "1002",
        simple: {
          limit: 20,
          period: 60,
        },
      }),
      MAP_GENERATION_RATE_LIMITER: bindings.rateLimit({
        namespace: "1003",
        simple: {
          limit: 5,
          period: 60,
        },
      }),
      ASSETS: bindings.assets(),
    },
  },
});
