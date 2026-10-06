import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Easing } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { createHeadingTracker, nearestHeading } from "@/lib/device-heading";
import { watchDeviceHeading } from "@/lib/watch-device-heading";

/** Compass samples animate only the native marker, without re-rendering the map or sheets. */
export function useDeviceHeading(enabled: boolean) {
  const reduceMotion = useReducedMotion();
  const reducedMotion = useRef(reduceMotion);
  const [bearing] = useState(() => new Animated.Value(0));
  const currentHeading = useRef(0);
  const hasHeading = useRef(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [tracker] = useState(() =>
    createHeadingTracker({
      watch: watchDeviceHeading,
      onHeading(heading) {
        if (heading === null) {
          bearing.stopAnimation();
          hasHeading.current = false;
          setIsAvailable(false);
          return;
        }
        if (!hasHeading.current) {
          hasHeading.current = true;
          currentHeading.current = heading;
          bearing.setValue(heading);
          setIsAvailable(true);
          return;
        }
        const target = nearestHeading(currentHeading.current, heading);
        // Avoid restarting an animation that is already close to its averaged target.
        if (Math.abs(target - currentHeading.current) < 1) return;
        bearing.stopAnimation();
        if (reducedMotion.current) {
          bearing.setValue(target);
        } else {
          Animated.timing(bearing, {
            toValue: target,
            duration: 120,
            easing: Easing.out(Easing.quad),
            // Mapbox styles use its layer bridge, rather than View transforms.
            useNativeDriver: false,
          }).start();
        }
      },
    }),
  );

  useEffect(() => {
    reducedMotion.current = reduceMotion;
  }, [reduceMotion]);

  useEffect(() => {
    const listener = bearing.addListener(({ value }) => {
      currentHeading.current = value;
    });
    return () => bearing.removeListener(listener);
  }, [bearing]);

  useEffect(() => {
    if (!enabled) return;
    if (AppState.currentState === "active") tracker.start();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") tracker.start();
      else tracker.stop();
    });
    return () => {
      subscription.remove();
      tracker.stop();
    };
  }, [enabled, tracker]);

  return { bearing, isAvailable: enabled && isAvailable };
}
