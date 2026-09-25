import { useEffect, useState } from "react";
import { AppState } from "react-native";

/** Whether the app is in the foreground, so refreshes can pause while it isn't. */
export function useAppIsActive() {
  const [appIsActive, setAppIsActive] = useState(AppState.currentState !== "background");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppIsActive(nextState === "active");
    });
    return () => subscription.remove();
  }, []);

  return appIsActive;
}
