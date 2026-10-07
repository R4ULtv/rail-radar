import ArrowUpDown from "lucide-react-native/icons/arrow-up-down";
import Compass from "lucide-react-native/icons/compass";
import LocateFixed from "lucide-react-native/icons/locate-fixed";
import Map from "lucide-react-native/icons/map";
import MapPin from "lucide-react-native/icons/map-pin";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Sparkles from "lucide-react-native/icons/sparkles";
import TrainFront from "lucide-react-native/icons/train-front";
import TramFront from "lucide-react-native/icons/tram-front";
import type { ComponentType } from "react";

import { expo } from "../../app.json";
import { getPreference, setPreference } from "@/lib/preferences";

export type Feature = {
  icon: ComponentType<{ size?: number; color?: string }>;
  title: string;
  description: string;
};

export type Release = { version: string; features: Feature[] };

/**
 * What each version adds, newest first, shown once after updating to it. Only what users would
 * notice; a version without an entry shows nothing.
 */
export const releases: Release[] = [
  {
    version: "0.5.0",
    features: [
      {
        icon: Compass,
        title: "See where your phone is pointing",
        description:
          "Tap Locate to show a smooth compass cone around your location dot. It stays visible while you browse the map.",
      },
      {
        icon: ArrowUpDown,
        title: "Put your saved stations in order",
        description:
          "Hold a saved station, then drag it to a new place. Saved and recent stations now show their distance too.",
      },
      {
        icon: LocateFixed,
        title: "Find your location faster",
        description:
          "Locate responds faster, with more reliable GPS acquisition. Search refreshes distances as it opens.",
      },
      {
        icon: Sparkles,
        title: "Smoother sheets on Android",
        description:
          "Loading animations and long saved lists run more smoothly. Settings confirmations now match the app's theme.",
      },
    ],
  },
  {
    version: "0.4.0",
    features: [
      {
        icon: TrainFront,
        title: "Departures near me",
        description:
          "Tap Nearby at the bottom left to open live departures at the closest train station.",
      },
      {
        icon: MapPin,
        title: "Compare nearby stations",
        description:
          "Switch between the three nearest train stations in the station sheet, with distances shown.",
      },
      {
        icon: Map,
        title: "More reliable maps",
        description:
          "Maps reuse cached tiles for longer and retry loading when your connection returns.",
      },
    ],
  },
  {
    version: "0.3.0",
    features: [
      {
        icon: LocateFixed,
        title: "Your position stays up to date",
        description:
          "The location dot moves with you. Tap Locate to have the map follow you, and pan to stop.",
      },
      {
        icon: TramFront,
        title: "Clearer metro and tram stops",
        description: "Find directions and nearby stops, with train-only controls cleared away.",
      },
      {
        icon: RefreshCw,
        title: "Fresher boards",
        description:
          "Departures and arrivals refresh sooner when the times received are already old.",
      },
    ],
  },
];

function compareVersions(a: string, b: string) {
  const [partsA, partsB] = [a.split(".").map(Number), b.split(".").map(Number)];
  for (let index = 0; index < Math.max(partsA.length, partsB.length); index++) {
    const difference = (partsA[index] ?? 0) - (partsB[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** The releases since the notes last shown, newest first. Read before the first render. */
export function unseenReleases(): Release[] {
  const current = expo.version;
  const seen = getPreference("lastSeenRelease");
  // A new install, or an update from before the changelog: only this version's notes.
  if (seen === null) return releases.filter(({ version }) => version === current);
  return releases.filter(
    ({ version }) => compareVersions(version, seen) > 0 && compareVersions(version, current) <= 0,
  );
}

export function markReleasesSeen() {
  setPreference("lastSeenRelease", expo.version);
}
