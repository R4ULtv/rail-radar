"use client";

import { useReducer, useRef, useSyncExternalStore } from "react";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { LazyMotion, domAnimation, m, AnimatePresence } from "motion/react";
import Link from "next/link";
import { Button, buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

const STORAGE_KEY = "banner-dismissed-v11";

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
              className="relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card/95 p-2.5 pr-10 shadow-lg shadow-black/8 backdrop-blur-md md:gap-3.5 md:p-3 md:pr-12 dark:shadow-black/25"
            >
              <div
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background shadow-xs md:size-11"
              >
                <svg viewBox="0 0 512 512" fill="none" className="size-full">
                  <rect width="512" height="512" rx="128" fill="#6363ff" />
                  <svg x="80" y="80" width="352" height="352" viewBox="0 0 24 24">
                    <path
                      fill="white"
                      d="M8 17q-.425 0-.712-.288T7 16t.288-.712T8 15h4q-.35-.425-.562-.925T11.1 13H6q-.425 0-.712-.288T5 12t.288-.712T6 11h5.1q.125-.575.338-1.075T12 9H8q-.425 0-.712-.288T7 8t.288-.712T8 7h8q2.075 0 3.538 1.463T21 12t-1.463 3.538T16 17zm8-2q1.25 0 2.125-.875T19 12t-.875-2.125T16 9t-2.125.875T13 12t.875 2.125T16 15M4 17q-.425 0-.712-.288T3 16t.288-.712T4 15h1q.425 0 .713.288T6 16t-.288.713T5 17zm12-5"
                    />
                  </svg>
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    A fresh look for Rail Radar
                  </p>
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] leading-none font-bold tracking-wider text-primary uppercase">
                    New
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  <span className="md:hidden">New identity and station photo galleries.</span>
                  <span className="hidden md:inline">
                    A new identity, plus photo galleries for major stations.
                  </span>
                </p>
              </div>

              <Link
                href="/stations"
                onClick={dismiss}
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "hidden rounded-lg transition-transform duration-150 active:scale-[0.97] md:inline-flex",
                )}
              >
                Explore
                <ArrowRightIcon data-icon="inline-end" />
              </Link>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={dismiss}
                aria-label="Dismiss announcement"
                className="absolute top-2 right-2 z-10 rounded-full text-muted-foreground hover:text-foreground md:top-2.5 md:right-2.5"
              >
                <XIcon className="size-3.5" />
              </Button>

              <Link
                href="/stations"
                onClick={dismiss}
                aria-label="Explore station photo galleries"
                className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:hidden"
              >
                <span className="sr-only">Explore station photo galleries</span>
              </Link>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
