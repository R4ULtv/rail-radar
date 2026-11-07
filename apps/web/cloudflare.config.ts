import { bindings, defineConfig } from "cf/config";

export default defineConfig(({ isPreview }) => ({
  worker: {
    name: "rail-radar-web",
    entrypoint: "@tanstack/react-start/server-entry",
    compatibilityDate: "2026-08-08",
    compatibilityFlags: ["nodejs_compat"],
    workersDev: false,
    previewUrls: false,
    limits: { cpuMs: 300 },
    domains: [
      { hostname: "railradar24.com", production: true, previews: true },
      "www.railradar24.com",
    ],
    observability: {
      enabled: true,
      issues: { enabled: true },
      headSamplingRate: 1,
      traces: { enabled: true, headSamplingRate: 0.2 },
    },
    env: {
      MAPBOX_SERVER_TOKEN: bindings.secret(),
      RESEND_API_KEY: bindings.secret(),
      STATION_IMAGES: bindings.r2({ name: "rail-radar", jurisdiction: "eu" }),
      // Previews share station photos and use separate rate-limit namespaces.
      RATE_LIMITER: bindings.rateLimit({
        namespace: isPreview ? "1003" : "1002",
        simple: { limit: 40, period: 10 },
      }),
      SIGNUP_RATE_LIMITER: bindings.rateLimit({
        namespace: isPreview ? "1005" : "1004",
        simple: { limit: 5, period: 60 },
      }),
    },
  },
}));
