import { useEffect, useRef, useState } from "react";

// Same as the web's useDebounce (packages/ui/src/hooks/use-debounce.ts).
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const sourceValue = useRef(value);

  useEffect(() => {
    sourceValue.current = value;
    if (delay <= 0) return;

    const timer = setTimeout(() => {
      setDebouncedValue(sourceValue.current);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return delay <= 0 ? value : debouncedValue;
}
