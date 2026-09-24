import type { Station } from "@repo/data/types";
import type { ImageSourcePropType } from "react-native";

/**
 * The web map's station icons as PNGs, rendered from the web SVGs by
 * `pnpm --filter=mobile generate:station-icons`. They are 64pt images.
 */
export const stationIcons: Record<Station["type"], ImageSourcePropType> = {
  rail: require("../../assets/station-icons/rail-icon.png"),
  metro: require("../../assets/station-icons/metro-icon.png"),
  light: require("../../assets/station-icons/light-icon.png"),
};
