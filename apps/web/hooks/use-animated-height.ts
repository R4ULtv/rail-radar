import * as React from "react";
import {
  useMotionValue,
  animate,
  type MotionValue,
  type Easing,
} from "motion/react";

interface UseAnimatedHeightOptions {
  duration?: number;
  shrinkDuration?: number;
  ease?: Easing;
}

interface UseAnimatedHeightReturn {
  contentRef: (node: HTMLElement | null) => void;
  height: MotionValue<number>;
}

export function useAnimatedHeight(
  options: UseAnimatedHeightOptions = {},
): UseAnimatedHeightReturn {
  const { duration = 0.2, shrinkDuration = 0.1, ease = "easeOut" } = options;

  const height = useMotionValue(0);
  const observerRef = React.useRef<ResizeObserver | null>(null);

  const contentRef = React.useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (node) {
        // Set initial height without animation
        height.jump(node.offsetHeight);

        observerRef.current = new ResizeObserver(() => {
          const currentHeight = height.get();
          const targetHeight = node.offsetHeight;
          const isShrinking = targetHeight < currentHeight;

          animate(height, targetHeight, {
            duration: isShrinking ? shrinkDuration : duration,
            ease,
          });
        });
        observerRef.current.observe(node);
      }
    },
    [height, duration, shrinkDuration, ease],
  );

  React.useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { contentRef, height };
}
