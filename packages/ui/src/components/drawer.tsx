// Temporary migration from @vaul to @base-ui. Should be updated when shadcn UI provides official support
"use client";

import * as React from "react";
import { DrawerPreview as DrawerPrimitive } from "@base-ui/react/drawer";

import { cn } from "@repo/ui/lib/utils";

function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Backdrop>) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        // base
        "fixed inset-0 z-50 min-h-dvh bg-black/20 supports-backdrop-filter:backdrop-blur-xs",
        // swipe-linked opacity using --backdrop-opacity pattern from docs
        "[--backdrop-opacity:0.2] dark:[--backdrop-opacity:0.7]",
        "opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))]",
        // transition
        "transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
        // while swiping — track finger, no transition
        "data-[swiping]:duration-0",
        // enter / exit
        "data-[starting-style]:opacity-0",
        "data-[ending-style]:opacity-0",
        "data-[ending-style]:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
        // iOS 26+ viewport fix
        "supports-[-webkit-touch-callout:none]:absolute",
        className,
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Popup>) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        className="fixed inset-0 z-50 flex items-end justify-center data-[swipe-direction=right]:items-stretch data-[swipe-direction=right]:justify-end data-[swipe-direction=left]:items-stretch data-[swipe-direction=left]:justify-start data-[swipe-direction=up]:items-start data-[swipe-direction=up]:justify-center"
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            // base
            "bg-background fixed z-50 flex h-auto flex-col text-sm",
            // touch + overscroll behavior
            "touch-auto overscroll-contain overflow-y-auto",

            /* --- bottom (default swipeDirection="down") --- */
            "data-[swipe-direction=down]:inset-x-0",
            "data-[swipe-direction=down]:bottom-0",
            "data-[swipe-direction=down]:mt-24",
            "data-[swipe-direction=down]:max-h-[80vh]",
            "data-[swipe-direction=down]:rounded-t-xl",
            "data-[swipe-direction=down]:border-t",
            // snap-point-offset + swipe movement — this is what makes snap points work
            "data-[swipe-direction=down]:[transform:translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))]",
            "data-[swipe-direction=down]:data-[starting-style]:[transform:translateY(100%)]",
            "data-[swipe-direction=down]:data-[ending-style]:[transform:translateY(100%)]",

            /* --- top --- */
            "data-[swipe-direction=up]:inset-x-0",
            "data-[swipe-direction=up]:top-0",
            "data-[swipe-direction=up]:mb-24",
            "data-[swipe-direction=up]:max-h-[80vh]",
            "data-[swipe-direction=up]:rounded-b-xl",
            "data-[swipe-direction=up]:border-b",
            "data-[swipe-direction=up]:[transform:translateY(var(--drawer-swipe-movement-y))]",
            "data-[swipe-direction=up]:data-[starting-style]:[transform:translateY(-100%)]",
            "data-[swipe-direction=up]:data-[ending-style]:[transform:translateY(-100%)]",

            /* --- right --- */
            "data-[swipe-direction=right]:inset-y-0",
            "data-[swipe-direction=right]:right-0",
            "data-[swipe-direction=right]:w-3/4",
            "data-[swipe-direction=right]:rounded-l-xl",
            "data-[swipe-direction=right]:border-l",
            "data-[swipe-direction=right]:sm:max-w-sm",
            "data-[swipe-direction=right]:[transform:translateX(var(--drawer-swipe-movement-x))]",
            "data-[swipe-direction=right]:data-[starting-style]:[transform:translateX(100%)]",
            "data-[swipe-direction=right]:data-[ending-style]:[transform:translateX(100%)]",

            /* --- left --- */
            "data-[swipe-direction=left]:inset-y-0",
            "data-[swipe-direction=left]:left-0",
            "data-[swipe-direction=left]:w-3/4",
            "data-[swipe-direction=left]:rounded-r-xl",
            "data-[swipe-direction=left]:border-r",
            "data-[swipe-direction=left]:sm:max-w-sm",
            "data-[swipe-direction=left]:[transform:translateX(var(--drawer-swipe-movement-x))]",
            "data-[swipe-direction=left]:data-[starting-style]:[transform:translateX(-100%)]",
            "data-[swipe-direction=left]:data-[ending-style]:[transform:translateX(-100%)]",

            /* --- shared transition --- */
            "transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
            "data-[swiping]:select-none",
            "data-[ending-style]:duration-[calc(var(--drawer-swipe-strength)*400ms)]",

            /* --- group for child selectors --- */
            "group/drawer-content",

            className,
          )}
          {...props}
        >
          {/* Handle — only visible for bottom drawers */}
          <div className="bg-muted mx-auto mt-4 hidden h-1.5 w-[100px] shrink-0 rounded-full group-data-[swipe-direction=down]/drawer-content:block" />

          <DrawerPrimitive.Content
            data-slot="drawer-inner-content"
            className="flex min-h-0 flex-1 flex-col"
          >
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 md:gap-1.5",
        "group-data-[swipe-direction=down]/drawer-content:text-center",
        "group-data-[swipe-direction=up]/drawer-content:text-center",
        "md:text-left",
        className,
      )}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-foreground font-medium", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
