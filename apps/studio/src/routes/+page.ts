import { dev } from "$app/environment";
import type { DataMode } from "$lib/stores/stations";

export const prerender = true;

export const load = (): { mode: DataMode } => ({
  mode: dev ? "local" : "browser",
});
