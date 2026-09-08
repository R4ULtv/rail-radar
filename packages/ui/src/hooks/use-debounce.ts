import * as React from "react";

interface DebounceState<T> {
  sourceValue: T;
  delay: number;
  debouncedValue: T;
}

export function useDebounce<T>(value: T, delay: number): T {
  const [state, setState] = React.useState<DebounceState<T>>(() => ({
    sourceValue: value,
    delay,
    debouncedValue: value,
  }));

  let currentState = state;
  if (!Object.is(state.sourceValue, value) || state.delay !== delay) {
    currentState = {
      sourceValue: value,
      delay,
      debouncedValue:
        delay <= 0 ? value : state.delay <= 0 ? state.sourceValue : state.debouncedValue,
    };
    setState(currentState);
  }

  React.useEffect(() => {
    if (delay <= 0) return;

    const timer = setTimeout(() => {
      setState((current) => ({ ...current, debouncedValue: value }));
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return delay <= 0 ? value : currentState.debouncedValue;
}
