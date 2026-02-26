"use client";

import { useEffect, useReducer } from "react";

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "narrow",
});

function formatRelativeTime(secondsAgo: number): string {
  if (secondsAgo < 5) {
    return "Updated just now";
  }
  const minutesAgo = Math.floor(secondsAgo / 60);
  if (minutesAgo >= 1) {
    return `Updated ${relativeTimeFormatter.format(-minutesAgo, "minute")}`;
  }
  return `Updated ${relativeTimeFormatter.format(-secondsAgo, "second")}`;
}

export function UpdatedStatus({
  isLoading,
  isValidating,
  lastUpdated,
}: {
  isLoading: boolean;
  isValidating: boolean;
  lastUpdated: Date | null;
}) {
  const [state, dispatch] = useReducer(
    (
      prev: { secondsAgo: number; showUpdating: boolean },
      action: { type: "tick"; value: number } | { type: "showUpdating"; value: boolean },
    ) => {
      switch (action.type) {
        case "tick":
          return prev.secondsAgo === action.value ? prev : { ...prev, secondsAgo: action.value };
        case "showUpdating":
          return prev.showUpdating === action.value
            ? prev
            : { ...prev, showUpdating: action.value };
      }
    },
    { secondsAgo: 0, showUpdating: false },
  );

  useEffect(() => {
    if (!lastUpdated) return;

    const calculate = () => Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    dispatch({ type: "tick", value: calculate() });

    const interval = setInterval(() => {
      dispatch({ type: "tick", value: calculate() });
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdated]);

  useEffect(() => {
    if (!isValidating) {
      dispatch({ type: "showUpdating", value: false });
      return;
    }
    const timer = setTimeout(() => dispatch({ type: "showUpdating", value: true }), 150);
    return () => clearTimeout(timer);
  }, [isValidating]);

  if ((isLoading && !lastUpdated) || state.showUpdating) {
    return "Updating...";
  }

  if (lastUpdated) {
    return formatRelativeTime(state.secondsAgo);
  }

  return null;
}
