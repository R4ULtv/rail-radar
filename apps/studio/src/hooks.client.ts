import type { HandleClientError } from "@sveltejs/kit";
import { initPostHog } from "$lib/analytics";

export const handleError: HandleClientError = ({ error, status, event }) => {
  initPostHog()?.captureException(error, { source: "sveltekit", status, route: event.route.id });
};
