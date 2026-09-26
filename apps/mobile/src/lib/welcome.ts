import { File, Paths } from "expo-file-system";

// Written once the welcome is closed, so it's only shown on the first launch.
const file = new File(Paths.document, "welcome.json");

/** Read before the first render, like the theme, so the welcome opens with the app. */
export function hasSeenWelcome(): boolean {
  try {
    return file.exists;
  } catch {
    // Better to skip the welcome than to show it on every launch.
    return true;
  }
}

export function markWelcomeSeen() {
  try {
    if (!file.exists) file.create();
    file.write(JSON.stringify({ seenAt: Date.now() }));
  } catch {
    // The welcome is shown once more on the next launch.
  }
}
