import type { HandleClientError } from "@sveltejs/kit/hooks";
import { initPostHog } from "#lib/analytics.ts";

export const handleError: HandleClientError = ({ error, kind, event }) => {
  if (kind === "app") return;
  const status = kind === "unknown" ? 500 : error.status;
  initPostHog()?.captureException(error, { source: "sveltekit", status, route: event.route.id });
};
