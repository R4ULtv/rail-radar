"use client";

import { useReducer, useRef, useSyncExternalStore } from "react";
import { XIcon } from "lucide-react";
import { LazyMotion, domAnimation, m, AnimatePresence } from "motion/react";
import { Button } from "@repo/ui/components/button";

const STORAGE_KEY = "banner-dismissed-v14";

const subscribe = () => () => {};
const getSnapshot = () => !localStorage.getItem(STORAGE_KEY);
const getServerSnapshot = () => false;

export function AnnouncementBanner() {
  const shouldShow = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dismissedRef = useRef(false);
  const [, rerender] = useReducer((value: number) => value + 1, 0);

  const visible = shouldShow && !dismissedRef.current;

  const dismiss = () => {
    dismissedRef.current = true;
    localStorage.setItem(STORAGE_KEY, "1");
    rerender();
  };

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {visible && (
          <m.div
            initial={{ opacity: 0, y: -12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute z-40 top-[calc(--spacing(4)+(--spacing(10))+(--spacing(2)))] left-4 right-4 md:top-4 md:left-[calc(--spacing(4)+20rem+(--spacing(3)))] md:right-auto"
          >
            <div
              role="status"
              className="relative flex items-center gap-3 overflow-hidden p-2.5 pr-10 md:gap-3.5 md:p-3 md:pr-12 bg-card border border-input text-card-foreground rounded-md shadow-xs"
            >
              <img
                aria-hidden="true"
                src="/icon.svg"
                alt=""
                className="size-10 shrink-0 rounded-md shadow-xs md:size-11"
              />

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    A faster Rail Radar is here
                  </p>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Rebuilt from the ground up for a smoother ride.
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={dismiss}
                aria-label="Dismiss announcement"
                className="absolute top-2 right-2 z-10 text-muted-foreground hover:text-foreground md:top-2.5 md:right-2.5"
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
