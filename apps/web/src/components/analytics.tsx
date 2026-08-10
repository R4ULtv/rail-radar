import { useEffect } from "react";
import { env } from "@/lib/env";

export function Analytics() {
  useEffect(() => {
    if (!env.posthogKey) return;

    void import("posthog-js").then(({ default: posthog }) => {
      if (posthog.__loaded) return;
      posthog.init(env.posthogKey, {
        api_host: "https://t.railradar24.com",
        ui_host: "https://eu.posthog.com",
        defaults: "2026-05-30",
        persistence: "memory",
        autocapture: false,
        capture_performance: { web_vitals: true },
      });
    });
  }, []);

  return null;
}
