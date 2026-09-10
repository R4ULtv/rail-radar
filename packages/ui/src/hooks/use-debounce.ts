import * as React from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  const sourceValue = React.useRef(value);

  React.useEffect(() => {
    sourceValue.current = value;
    if (delay <= 0) return;

    const timer = setTimeout(() => {
      setDebouncedValue(sourceValue.current);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return delay <= 0 ? value : debouncedValue;
}
