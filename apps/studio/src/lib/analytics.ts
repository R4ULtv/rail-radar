import posthog from "posthog-js";
// Bundle the extensions we use so PostHog never fetches SDK code at runtime.
import "posthog-js/dist/exception-autocapture";
import "posthog-js/dist/web-vitals";

export function initPostHog() {
  const posthogKey = import.meta.env.PUBLIC_POSTHOG_KEY;
  if (typeof window === "undefined" || !posthogKey) return;
  if (posthog.__loaded) return posthog;

  posthog.init(posthogKey, {
    api_host: "https://t.railradar24.com",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-08-29",
    persistence: "memory",
    capture_pageview: "history_change",
    autocapture: false,
    // Without attribution PostHog uses the plain "web-vitals" bundle imported above.
    capture_performance: { web_vitals: true, web_vitals_attribution: false },
    capture_exceptions: true,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_web_experiments: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    advanced_disable_toolbar_metrics: true,
  });
  return posthog;
}
