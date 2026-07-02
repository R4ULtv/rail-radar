import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "https://t.railradar24.com",
  ui_host: "https://eu.posthog.com",
  defaults: "2026-05-30",
  // Cookieless: no consent banner is shipped, match Vercel Analytics' posture.
  persistence: "memory",
  autocapture: false,
  capture_performance: { web_vitals: true },
});
