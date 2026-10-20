<script lang="ts">
  import type { Line } from "@repo/data";
  import { getLineBadgeCode, getLineColor, getLineTextColor } from "$lib/line-colors";
  import { cn } from "$lib/utils";

  let { line, class: className }: { line: Pick<Line, "code" | "color">; class?: string } = $props();

  const color = $derived(getLineColor(line));
  const code = $derived(getLineBadgeCode(line));
</script>

{#if code}
  <span
    class={cn(
      "inline-flex h-4 min-w-6 shrink-0 items-center justify-center px-1 font-mono text-[10px] font-semibold leading-none",
      className,
    )}
    style:background-color={color}
    style:color={getLineTextColor(color)}>{code}</span
  >
{:else}
  <span class={cn("flex h-4 min-w-6 shrink-0 items-center justify-center", className)}>
    <span class="h-1 w-4" style:background-color={color}></span>
  </span>
{/if}
