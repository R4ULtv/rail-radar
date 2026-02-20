"use client";

import * as React from "react";
import { DrawerPreview as DrawerPrimitive } from "@base-ui/react/drawer";

import { cn } from "@repo/ui/lib/utils";

const DrawerModalContext = React.createContext<boolean | "trap-focus">(true);

function DrawerProvider({ ...props }: DrawerPrimitive.Provider.Props) {
  return <DrawerPrimitive.Provider data-slot="drawer-provider" {...props} />;
}

function DrawerIndentBackground({
  className,
  ...props
}: DrawerPrimitive.IndentBackground.Props) {
  return (
    <DrawerPrimitive.IndentBackground
      data-slot="drawer-indent-background"
      className={cn(
        "fixed inset-0 bg-background transition-[transform,border-radius] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
        "data-[active]:scale-[0.94] data-[active]:rounded-xl",
        className,
      )}
      {...props}
    />
  );
}

function DrawerIndent({ className, ...props }: DrawerPrimitive.Indent.Props) {
  return (
    <DrawerPrimitive.Indent
      data-slot="drawer-indent"
      className={cn(
        "transition-[transform,border-radius] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
        "data-[active]:scale-[0.94] data-[active]:rounded-xl data-[active]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

function Drawer({ modal = true, ...props }: DrawerPrimitive.Root.Props) {
  return (
    <DrawerModalContext value={modal}>
      <DrawerPrimitive.Root data-slot="drawer" modal={modal} {...props} />
    </DrawerModalContext>
  );
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
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

function DrawerViewport({
  className,
  ...props
}: DrawerPrimitive.Viewport.Props) {
  return (
    <DrawerPrimitive.Viewport
      data-slot="drawer-viewport"
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center",
        "data-[swipe-direction=right]:items-stretch data-[swipe-direction=right]:justify-end",
        "data-[swipe-direction=left]:items-stretch data-[swipe-direction=left]:justify-start",
        "data-[swipe-direction=up]:items-start data-[swipe-direction=up]:justify-center",
        className,
      )}
      {...props}
    />
  );
}

function DrawerPopup({ className, ...props }: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPrimitive.Popup
      data-slot="drawer-popup"
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
    />
  );
}

function DrawerInnerContent({
  className,
  ...props
}: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      data-slot="drawer-inner-content"
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      {...props}
    />
  );
}

function DrawerHandle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-handle"
      className={cn(
        "bg-muted mx-auto mt-4 hidden h-1.5 w-[100px] shrink-0 rounded-full group-data-[swipe-direction=down]/drawer-content:block",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Composed DrawerContent that bundles Portal + Overlay + Viewport + Popup + Content.
 * This is the standard shadcn pattern for convenience. For advanced composition,
 * use the individual primitives (DrawerPortal, DrawerOverlay, DrawerViewport,
 * DrawerPopup, DrawerInnerContent) directly.
 *
 * Automatically adapts to modal vs non-modal mode:
 * - Modal (default): renders overlay, viewport blocks pointer events
 * - Non-modal: no overlay, viewport passes pointer events through
 */
function DrawerContent({
  className,
  children,
  ...props
}: DrawerPrimitive.Popup.Props) {
  const modal = React.use(DrawerModalContext);
  const isNonModal = modal === false;

  return (
    <DrawerPortal>
      {!isNonModal && <DrawerOverlay />}
      <DrawerViewport
        className={isNonModal ? "pointer-events-none" : undefined}
      >
        <DrawerPopup
          className={cn(isNonModal && "pointer-events-auto", className)}
          {...props}
        >
          <DrawerHandle />

          <DrawerInnerContent>{children}</DrawerInnerContent>
        </DrawerPopup>
      </DrawerViewport>
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

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
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
}: DrawerPrimitive.Description.Props) {
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
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHandle,
  DrawerHeader,
  DrawerIndent,
  DrawerIndentBackground,
  DrawerInnerContent,
  DrawerOverlay,
  DrawerPopup,
  DrawerPortal,
  DrawerProvider,
  DrawerTitle,
  DrawerTrigger,
  DrawerViewport,
};
