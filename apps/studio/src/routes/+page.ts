import { dev } from "$app/env";
import type { DataMode } from "#lib/stores/stations.ts";

export const prerender = true;

export const load = (): { mode: DataMode } => ({
  mode: dev ? "local" : "browser",
});
