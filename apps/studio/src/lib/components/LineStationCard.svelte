<script lang="ts">
  import type { Line, LineRoute, Station } from "@repo/data";
  import { CheckIcon, PlusIcon, XIcon } from "@lucide/svelte";
  import LineBadge from "$lib/components/LineBadge.svelte";
  import { Button } from "$lib/components/ui/button";

  let {
    station,
    stationLines,
    route,
    routeLabel,
    saving,
    onSelectLine,
    onAddToRoute,
    onClose,
  }: {
    station: Station;
    stationLines: readonly Line[];
    /** The branch being edited, or null when no line is open. */
    route: LineRoute | null;
    routeLabel: string | number;
    saving: boolean;
    onSelectLine: (id: string) => void;
    onAddToRoute: () => void;
    onClose: () => void;
  } = $props();

  // Rings and loops revisit stops, so only an immediate repeat is blocked.
  const onRoute = $derived(!!route?.stations.includes(station.id));
  const isLastStop = $derived(route?.stations.at(-1) === station.id);
</script>

<div
  class="absolute left-3 top-3 z-10 w-72 max-w-[calc(100%-1.5rem)] border border-border bg-card/95 text-card-foreground shadow-xl backdrop-blur"
>
  <div class="flex items-start justify-between gap-3 border-b border-border px-3 py-2.5">
    <div class="min-w-0">
      <div class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Station
      </div>
      <h3 class="mt-0.5 truncate text-sm font-semibold">{station.name}</h3>
      <p class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
        {station.id}
      </p>
    </div>
    <Button variant="ghost" size="icon-xs" aria-label="Close station details" onclick={onClose}>
      <XIcon class="size-3" />
    </Button>
  </div>

  <div class="flex flex-col gap-1 px-1.5 py-1.5">
    <div class="px-1.5 pb-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      Lines · {stationLines.length}
    </div>
    {#each stationLines as line (line.id)}
      <Button
        variant="ghost"
        size="sm"
        class="h-8 w-full justify-start gap-2 px-1.5 text-left font-normal text-muted-foreground hover:text-foreground"
        title={`${line.name}\n${line.operator ?? line.id}`}
        onclick={() => onSelectLine(line.id)}
      >
        <LineBadge {line} />
        <span class="min-w-0 flex-1 truncate text-xs">{line.name}</span>
      </Button>
    {:else}
      <p class="px-1.5 pb-1 text-xs text-muted-foreground">No saved line assigned</p>
    {/each}
  </div>

  {#if route}
    <div class="border-t border-border p-2">
      <Button
        class="w-full"
        size="sm"
        variant="outline"
        disabled={saving || isLastStop}
        onclick={onAddToRoute}
      >
        {#if isLastStop}
          <CheckIcon class="size-3.5" />
          Last stop of route {routeLabel}
        {:else}
          <PlusIcon class="size-3.5" />
          {onRoute ? "Add again to route" : "Add to route"}
          {routeLabel}
        {/if}
      </Button>
    </div>
  {/if}
</div>
