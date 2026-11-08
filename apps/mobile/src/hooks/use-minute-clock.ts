import { useEffect, useState } from "react";

import { useAppIsActive } from "@/hooks/use-app-is-active";

/**
 * The current time, ticking on each minute while the app is in the foreground and read
 * again when it comes back, so a line's running status doesn't go stale.
 */
export function useMinuteClock(): Date {
  const appIsActive = useAppIsActive();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!appIsActive) return;
    setNow(new Date());
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      // Lands just after the minute turns, when the status can change.
      timer = setTimeout(
        () => {
          setNow(new Date());
          tick();
        },
        60_000 - (Date.now() % 60_000) + 50,
      );
    };
    tick();
    return () => clearTimeout(timer);
  }, [appIsActive]);

  return now;
}
