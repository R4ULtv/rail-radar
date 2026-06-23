"use client";

import { useEffect, useState } from "react";

const CELLS = 5;
const FILLED = "▰";
const EMPTY = "▱";

// Fill left-to-right from empty, then drain — a continuous wave loop.
const FRAMES = Array.from({ length: CELLS * 2 }, (_, step) => {
  const filling = step <= CELLS;
  const count = filling ? step : CELLS * 2 - step;
  return FILLED.repeat(count) + EMPTY.repeat(CELLS - count);
});

export default function MapLoading() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, 120);

    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <span className="relative inline-flex items-center justify-center">
        <span
          aria-hidden="true"
          className="text-accent font-mono text-3xl leading-none tabular-nums"
        >
          {FRAMES[frame]}
        </span>
        <span role="status" aria-live="polite" className="sr-only">
          Loading
        </span>
      </span>
    </div>
  );
}
