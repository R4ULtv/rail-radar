import * as React from "react";

interface UseAnimatedHeightOptions {
  /** Duration of the animation in ms */
  duration?: number;
  /** Easing function for the animation */
  easing?: string;
}

interface UseAnimatedHeightReturn {
  /** Ref to attach to the content wrapper (inner element that gets measured) */
  contentRef: React.RefCallback<HTMLElement>;
  /** Style props to apply to the animated container (outer element) */
  style: React.CSSProperties;
}

export function useAnimatedHeight(
  options: UseAnimatedHeightOptions = {},
): UseAnimatedHeightReturn {
  const { duration = 200, easing = "ease-out" } = options;

  const [height, setHeight] = React.useState<number>(0);
  const observerRef = React.useRef<ResizeObserver | null>(null);

  const contentRef = React.useCallback((node: HTMLElement | null) => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (node) {
      // Measure initial height
      setHeight(node.offsetHeight);

      // Observe for size changes
      observerRef.current = new ResizeObserver(() => {
        setHeight(node.offsetHeight);
      });
      observerRef.current.observe(node);
    }
  }, []);

  // Cleanup observer on unmount
  React.useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const style: React.CSSProperties = {
    height,
    overflow: "hidden",
    transition: `height, ${duration}ms ${easing}, opacity ${duration}ms ${easing}`,
  };

  return { contentRef, style };
}
