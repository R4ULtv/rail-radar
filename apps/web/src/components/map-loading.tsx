"use client";

import { useEffect, useState } from "react";

const CELLS = 5;
const FILLED = "▰";
const EMPTY = "▱";

// Fill left-to-right from empty until full, then empty left-to-right —
// a continuous wave that always travels in the same direction.
const FRAMES = Array.from({ length: CELLS * 2 }, (_, step) => {
  if (step <= CELLS) {
    // Filling: add a cell on the right edge each step.
    return FILLED.repeat(step) + EMPTY.repeat(CELLS - step);
  }
  // Draining: clear a cell from the left edge each step.
  const empty = step - CELLS;
  return EMPTY.repeat(empty) + FILLED.repeat(CELLS - empty);
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
          className="text-accent font-mono text-3xl md:text-2xl leading-none tracking-tighter tabular-nums"
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
