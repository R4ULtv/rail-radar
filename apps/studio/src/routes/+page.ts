import { env } from "$env/dynamic/public";
import type { DataMode } from "$lib/stores/stations";

export const ssr = false;

export const load = () => {
  const mode: DataMode = env.PUBLIC_STUDIO_LOCAL_MODE === "true" ? "local" : "browser";

  return {
    mode,
  };
};
