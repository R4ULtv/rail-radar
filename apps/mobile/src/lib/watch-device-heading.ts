import * as Location from "expo-location";

/** Explicit development preview: iOS Simulator has no magnetometer. Release uses real sensors. */
export function watchDeviceHeading(
  onHeading: Location.LocationHeadingCallback,
  onError: Location.LocationErrorCallback,
): Promise<Location.LocationSubscription> {
  if (!__DEV__ || process.env.EXPO_PUBLIC_SIMULATE_HEADING !== "1") {
    return Location.watchHeadingAsync(onHeading, onError);
  }

  console.info("Compass preview: using simulated phone headings.");
  // Start near north so the preview also exercises the 359° → 0° transition.
  let heading = 350;
  const emit = () => onHeading({ trueHeading: heading, magHeading: heading, accuracy: 3 });
  emit();
  const timer = setInterval(() => {
    heading = (heading + 2) % 360;
    emit();
  }, 80);
  return Promise.resolve({ remove: () => clearInterval(timer) });
}
