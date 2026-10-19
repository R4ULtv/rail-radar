"use client";

import posthog from "posthog-js";

/**
 * Registry of custom events. Add new events here so names and payloads
 * stay consistent across the app.
 */
export type AnalyticsEvents = {
  station_viewed: { stationId: string; country: string };
  map_style_changed: { style: string };
};

export function trackEvent<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
) {
  posthog.capture(event, properties);
}

export function captureException(error: unknown, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  // Error boundaries can run before the Analytics component mounts.
  void import("./posthog").then(({ initPostHog }) => {
    initPostHog()?.captureException(error, properties);
  });
}
