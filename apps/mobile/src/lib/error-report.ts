import { Dimensions, Platform } from "react-native";

import { bugReportUrl } from "@/lib/links";
import { expo } from "../../app.json";

export interface CapturedError {
  error: unknown;
  componentStack: string;
}

/** Kept on the device until the user chooses to report or share it. */
export function createErrorReport({ error, componentStack }: CapturedError) {
  const { width, height, scale, fontScale } = Dimensions.get("window");
  const build = Platform.OS === "android" ? expo.android.versionCode : expo.ios.buildNumber;
  const os =
    Platform.OS === "android"
      ? `Android ${Platform.constants.Release} (API ${Platform.Version}), ${Platform.constants.Manufacturer} ${Platform.constants.Model}`
      : `${Platform.OS} ${Platform.Version}`;
  const environment = `Rail Radar ${expo.version} (build ${build}); ${os}; window ${width} × ${height}, scale ${scale}, font scale ${fontScale}`;
  const stack = error instanceof Error ? (error.stack ?? String(error)) : String(error);
  const details = `### Error\n\n\`\`\`text\n${stack}\n\`\`\`\n\n### React component stack\n\n\`\`\`text\n${componentStack || "Unavailable"}\n\`\`\``;

  // Keep the browser URL manageable. The native share sheet carries the complete stacks.
  const urlDetails =
    details.length > 4_000
      ? `${details.slice(0, 4_000)}\n\n[Truncated; use Share error details for the full report.]`
      : details;

  return {
    url: `${bugReportUrl}&env=${encodeURIComponent(environment)}&additional=${encodeURIComponent(urlDetails)}`,
    message: `Rail Radar error report\n\n${environment}\n\n${details}`,
  };
}
