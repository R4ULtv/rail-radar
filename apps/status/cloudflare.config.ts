import { defineConfig } from "cf/config";

// Static assets only: Astro prerenders the page and there is no server Worker.
export default defineConfig({
  worker: {
    name: "rail-radar-status",
    compatibilityDate: "2026-11-06",
    observability: {
      issues: {
        enabled: true,
      },
    },
    domains: ["status.railradar24.com"],
  },
});
