import * as React from "react";
import {
  useMotionValue,
  animate,
  type MotionValue,
  type Easing,
  type BezierDefinition,
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

export function useAnimatedHeight(options: UseAnimatedHeightOptions = {}): UseAnimatedHeightReturn {
  const {
    duration = 0.2,
    shrinkDuration = 0.1,
    ease = [0.23, 1, 0.32, 1] as BezierDefinition,
  } = options;

  const height = useMotionValue(0);

  const optionsRef = React.useRef({ duration, shrinkDuration, ease });
  optionsRef.current = { duration, shrinkDuration, ease };

  const contentRef = React.useCallback(
    (node: HTMLElement | null) => {
      if (!node) return;

      const initialHeight = node.offsetHeight;
      if (initialHeight > 0) {
        height.jump(initialHeight);
      }

      let hasValidHeight = initialHeight > 0;

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;

        const targetHeight = entry.borderBoxSize?.[0]
          ? entry.borderBoxSize[0].blockSize
          : node.offsetHeight;

        if (targetHeight === 0) return;

        if (!hasValidHeight) {
          hasValidHeight = true;
          height.jump(targetHeight);
          return;
        }

        const currentHeight = height.get();
        if (Math.abs(targetHeight - currentHeight) < 1) return;

        const { duration, shrinkDuration, ease } = optionsRef.current;
        const isShrinking = targetHeight < currentHeight;

        animate(height, targetHeight, {
          duration: isShrinking ? shrinkDuration : duration,
          ease,
        });
      });

      observer.observe(node);

      return () => {
        observer.disconnect();
      };
    },
    [height],
  );

  return { contentRef, height };
}
