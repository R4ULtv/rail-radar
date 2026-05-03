import type { Station } from "@repo/data";

export const STATION_TYPE_COLOR: Record<Station["type"], string> = {
  rail: "#4b61d1",
  metro: "#f22a18",
  light: "#14b8a6",
};
