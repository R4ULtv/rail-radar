import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const { AndroidHaptics, ImpactFeedbackStyle, NotificationFeedbackType } = Haptics;

/**
 * Plays a haptic on iOS, or its Android counterpart. On Android the system haptics are
 * used rather than the vibrator, so they follow the phone's touch feedback setting.
 */
function play(ios: () => Promise<void>, android: Haptics.AndroidHaptics) {
  const feedback =
    Platform.OS === "android"
      ? // Some types need Android 11 or 14; older phones get the basic click instead.
        Haptics.performAndroidHapticsAsync(android).catch(() =>
          Haptics.performAndroidHapticsAsync(AndroidHaptics.Context_Click),
        )
      : ios();
  // Haptics are a nicety and should never surface errors.
  feedback.catch(() => {});
}

export const haptics = {
  /** A tap that does something: picking a station, locating, turning north up. */
  tap: () =>
    play(() => Haptics.impactAsync(ImpactFeedbackStyle.Light), AndroidHaptics.Context_Click),
  /** Switching between options, like departures and arrivals. */
  selection: () => play(Haptics.selectionAsync, AndroidHaptics.Segment_Tick),
  toggleOn: () =>
    play(
      () => Haptics.notificationAsync(NotificationFeedbackType.Success),
      AndroidHaptics.Toggle_On,
    ),
  toggleOff: () =>
    play(() => Haptics.impactAsync(ImpactFeedbackStyle.Light), AndroidHaptics.Toggle_Off),
  /** Something the user asked for didn't work. */
  error: () =>
    play(() => Haptics.notificationAsync(NotificationFeedbackType.Error), AndroidHaptics.Reject),
};
