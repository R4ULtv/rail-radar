import { defineConfig } from "cf/config";

// Static assets only: Astro prerenders the page and there is no server Worker.
export default defineConfig({
  worker: {
    name: "rail-radar-status",
    compatibilityDate: "2026-11-06",
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
    domains: ["status.railradar24.com"],
  },
});
