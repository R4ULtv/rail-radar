import { File, Paths } from "expo-file-system";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import TramFront from "lucide-react-native/icons/tram-front";
import ZoomIn from "lucide-react-native/icons/zoom-in";
import type { ComponentType } from "react";

import { expo } from "../../app.json";

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
    version: "0.3.0",
    features: [
      {
        icon: TramFront,
        title: "Clearer metro and tram stops",
        description: "They show what they have: directions and the stops nearby.",
      },
      {
        icon: ZoomIn,
        title: "The right zoom for every station",
        description: "Opening a station zooms in just enough to see what's around it.",
      },
      {
        icon: RefreshCw,
        title: "Fresher boards",
        description: "Departures and arrivals update as soon as new times are in.",
      },
    ],
  },
];

// The last version whose notes were shown.
const file = new File(Paths.document, "changelog.json");

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
  try {
    const seen: unknown = file.exists ? JSON.parse(file.textSync()).version : null;
    // A new install, or an update from before the changelog: only this version's notes.
    if (typeof seen !== "string") return releases.filter(({ version }) => version === current);
    return releases.filter(
      ({ version }) => compareVersions(version, seen) > 0 && compareVersions(version, current) <= 0,
    );
  } catch {
    // Better to skip the notes than to show them on every launch.
    return [];
  }
}

export function markReleasesSeen() {
  try {
    if (!file.exists) file.create();
    file.write(JSON.stringify({ version: expo.version }));
  } catch {
    // The notes are shown once more on the next launch.
  }
}
