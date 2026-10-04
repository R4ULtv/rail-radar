import { File, Paths } from "expo-file-system";

// Written once the nearby button has opened a station; from then on it has no label.
const file = new File(Paths.document, "nearby-button.json");

/** Read before the first render, so the button doesn't change size on launch. */
export function hasUsedNearbyButton(): boolean {
  try {
    return file.exists;
  } catch {
    // The label is shown once more, which is better than never explaining the icon.
    return false;
  }
}

export function markNearbyButtonUsed() {
  try {
    if (!file.exists) file.create();
    file.write(JSON.stringify({ usedAt: Date.now() }));
  } catch {
    // The label is shown again on the next launch.
  }
}
