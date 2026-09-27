import { useEffect, useState } from "react";

export type DeviceCheck = { platform: "checking" | "android" | "ios" | "other" };

function detectDevice(): DeviceCheck {
  const ua = navigator.userAgent;

  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return { platform: "ios" };
  }
  return { platform: /Android/.test(ua) ? "android" : "other" };
}

/** Reads the visitor's platform after hydration. */
export function useDeviceCheck(): DeviceCheck {
  const [device, setDevice] = useState<DeviceCheck>({ platform: "checking" });

  useEffect(() => {
    setDevice(detectDevice());
  }, []);

  return device;
}
