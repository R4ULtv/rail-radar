import posthog from "posthog-js";
import { env } from "./env";

export function initPostHog() {
  if (typeof window === "undefined" || !env.posthogKey) return;
  if (posthog.__loaded) return posthog;

  posthog.init(env.posthogKey, {
    api_host: "https://t.railradar24.com",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-08-29",
    persistence: "memory",
    capture_pageview: "history_change",
    autocapture: false,
    capture_performance: { web_vitals: true },
    capture_exceptions: true,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_web_experiments: true,
    disable_product_tours: true,
    disable_conversations: true,
    // Web vitals and exception capture both load SDK extensions on demand.
    disable_external_dependency_loading: false,
    advanced_disable_flags: true,
    advanced_disable_toolbar_metrics: true,
  });
  return posthog;
}
