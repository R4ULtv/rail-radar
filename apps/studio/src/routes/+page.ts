import type { DataMode } from "$lib/stores/stations";

export const prerender = true;

export const load = () => {
  const mode: DataMode = import.meta.env.PUBLIC_STUDIO_LOCAL_MODE === "true" ? "local" : "browser";

  return {
    mode,
  };
};
