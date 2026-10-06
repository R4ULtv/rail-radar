interface HeadingSample {
  trueHeading: number;
  magHeading: number;
  accuracy: number;
}

export interface DeviceHeading {
  degrees: number;
  reference: "true-north" | "magnetic-north";
  accuracy: 2 | 3;
}

interface HeadingSubscription {
  remove: () => void;
}

interface HeadingTrackerOptions {
  watch: (
    onHeading: (sample: HeadingSample) => void,
    onError: (message: string) => void,
  ) => Promise<HeadingSubscription>;
  onHeading: (heading: number | null) => void;
  clock?: HeadingClock;
}

interface HeadingClock {
  now: () => number;
  schedule: (callback: () => void) => ReturnType<typeof setTimeout>;
  cancel: (timer: ReturnType<typeof setTimeout>) => void;
}

const headingClock: HeadingClock = {
  now: () => performance.now(),
  schedule: (callback) => setTimeout(callback, 50),
  cancel: clearTimeout,
};

// Average ordinary compass noise over 350ms, with faster catch-up for substantial turns.
const headingSmoothingMs = 350;
const turningSmoothingMs = 120;
const substantialTurnDegrees = 25;
const headingDeadZoneDegrees = 2;

/** GPS course describes travel; the compass describes where the phone is pointing. */
export function readDeviceHeading(sample: HeadingSample): DeviceHeading | null {
  // Expo's calibration scale is 0–3. Low accuracy can mean up to 50° of uncertainty on iOS.
  if (sample.accuracy !== 2 && sample.accuracy !== 3) return null;
  const { trueHeading, magHeading, accuracy } = sample;
  // Expo Android uses a signed remainder after applying magnetic declination. A valid
  // true-north heading can therefore be negative near north; -1 means unavailable.
  if (
    Number.isFinite(trueHeading) &&
    trueHeading !== -1 &&
    trueHeading >= -180 &&
    trueHeading <= 360
  ) {
    return { degrees: ((trueHeading % 360) + 360) % 360, reference: "true-north", accuracy };
  }
  if (Number.isFinite(magHeading) && magHeading >= 0 && magHeading <= 360) {
    return { degrees: magHeading % 360, reference: "magnetic-north", accuracy };
  }
  return null;
}

/** An unwrapped target keeps a turn through north from animating almost a full circle. */
export function nearestHeading(current: number, next: number) {
  const normalized = ((current % 360) + 360) % 360;
  return current + (((next - normalized + 540) % 360) - 180);
}

/** A circular, time-based average. Keep settling even when the native sensor stops emitting. */
export function createHeadingSmoother(
  onHeading: (heading: number | null) => void,
  clock: HeadingClock = headingClock,
) {
  let filtered: number | null = null;
  let target = 0;
  let published = 0;
  let lastUpdate = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function advance(now: number) {
    if (filtered === null) return true;
    const elapsed = Math.max(0, now - lastUpdate);
    lastUpdate = now;
    const difference = target - filtered;
    const smoothing =
      Math.abs(difference) > substantialTurnDegrees ? turningSmoothingMs : headingSmoothingMs;
    filtered += difference * (1 - Math.exp(-elapsed / smoothing));
    const settled = Math.abs(target - filtered) < 0.1;
    if (settled) filtered = target;
    return settled;
  }

  function tick() {
    timer = null;
    const settled = advance(clock.now());
    if (filtered === null) return;
    if (Math.abs(filtered - published) >= headingDeadZoneDegrees) {
      published = filtered;
      onHeading(((filtered % 360) + 360) % 360);
    }
    if (!settled) timer = clock.schedule(tick);
  }

  function reset() {
    if (timer !== null) clock.cancel(timer);
    timer = null;
    filtered = null;
  }

  return {
    reset,
    update(heading: number | null) {
      if (heading === null) {
        reset();
        onHeading(null);
      } else if (filtered === null) {
        filtered = target = published = heading;
        lastUpdate = clock.now();
        onHeading(heading);
      } else {
        // Time before this sample belongs to the previous target, including a long idle
        // period. Counting it toward the new target would bypass smoothing after stillness.
        advance(clock.now());
        target = nearestHeading(filtered, heading);
        if (
          timer === null &&
          (Math.abs(target - filtered) >= 0.1 ||
            Math.abs(target - published) >= headingDeadZoneDegrees)
        ) {
          // Run outside the sensor callback so a burst of samples shares one averaging timer.
          timer = clock.schedule(tick);
        }
      }
    },
  };
}

/** Serialize native setup so a late subscription cannot overlap a new foreground session. */
export function createHeadingTracker({ watch, onHeading, clock }: HeadingTrackerOptions) {
  let active = false;
  let generation = 0;
  let subscription: HeadingSubscription | null = null;
  let pending = Promise.resolve();
  let reference: DeviceHeading["reference"] | null = null;
  const smoother = createHeadingSmoother(onHeading, clock);

  function clearHeading() {
    reference = null;
    smoother.update(null);
  }

  return {
    start() {
      if (active) return;
      active = true;
      const session = ++generation;
      const isCurrent = () => active && generation === session;
      pending = pending.then(async () => {
        if (!isCurrent()) return;
        try {
          const next = await watch(
            (sample) => {
              if (!isCurrent()) return;
              const reading = readDeviceHeading(sample);
              if (!reading) {
                clearHeading();
                return;
              }
              // Never average angles measured against different north references.
              if (reference !== reading.reference) smoother.reset();
              reference = reading.reference;
              smoother.update(reading.degrees);
            },
            () => {
              if (isCurrent()) clearHeading();
            },
          );
          if (isCurrent()) subscription = next;
          else next.remove();
        } catch {
          if (isCurrent()) clearHeading();
        }
      });
    },
    stop() {
      active = false;
      generation++;
      subscription?.remove();
      subscription = null;
      clearHeading();
    },
  };
}
