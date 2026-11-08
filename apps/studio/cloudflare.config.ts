import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "rail-radar-studio",
    compatibilityDate: "2026-09-08",
    limits: {
      cpuMs: 100,
    },
    observability: {
      issues: {
        enabled: true,
      },
    },
    domains: ["studio.railradar24.com"],
  },
});
