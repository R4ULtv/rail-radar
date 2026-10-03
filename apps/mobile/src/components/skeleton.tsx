import type { ComponentProps } from "react";
import { Skeleton as HeroSkeleton } from "heroui-native/skeleton";

// No fade in or out, only the shimmer. On Android, a fade-out that was cut short (its list
// unmounted mid-fade) left the bones stuck on screen, over every sheet, until a restart.
const animation = { entering: false, exiting: false } as const;

/** HeroUI's skeleton without the enter and exit fades, which can leave ghost bones on Android. */
export function Skeleton(props: Omit<ComponentProps<typeof HeroSkeleton>, "animation">) {
  return <HeroSkeleton animation={animation} {...props} />;
}
