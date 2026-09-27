import { useEffect, useState } from "react";

/** The app's minSdkVersion is 30, which is Android 11. */
export const MIN_ANDROID_VERSION = 11;

export type DeviceCheck = {
  platform: "checking" | "android" | "ios" | "other";
  /** Major Android version, or null when the browser doesn't reveal it. */
  androidVersion: number | null;
};

type UserAgentData = {
  getHighEntropyValues(hints: string[]): Promise<{ platformVersion?: string }>;
};

async function detectDevice(): Promise<DeviceCheck> {
  const ua = navigator.userAgent;

  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return { platform: "ios", androidVersion: null };
  }
  if (!/Android/.test(ua)) return { platform: "other", androidVersion: null };

  return { platform: "android", androidVersion: await detectAndroidVersion(ua) };
}

async function detectAndroidVersion(ua: string): Promise<number | null> {
  // Chromium browsers freeze the user agent at "Android 10; K" and only share the real version
  // through client hints.
  const userAgentData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  if (userAgentData) {
    try {
      const { platformVersion } = await userAgentData.getHighEntropyValues(["platformVersion"]);
      const major = Number.parseInt(platformVersion ?? "", 10);
      if (major > 0) return major;
    } catch {
      // Fall back to the user agent.
    }
  }

  if (/Android 10; K\)/.test(ua)) return null;
  const match = /Android (\d+)/.exec(ua);
  return match ? Number(match[1]) : null;
}

/** Reads the visitor's platform and Android version after hydration. */
export function useDeviceCheck(): DeviceCheck {
  const [device, setDevice] = useState<DeviceCheck>({ platform: "checking", androidVersion: null });

  useEffect(() => {
    let active = true;
    void detectDevice().then((detected) => {
      if (active) setDevice(detected);
    });
    return () => {
      active = false;
    };
  }, []);

  return device;
}
