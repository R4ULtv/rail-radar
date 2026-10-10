<script lang="ts">
  import type { Line, LineRoute } from "@repo/data";
  import { ActivityIcon, DatabaseIcon, RouteIcon, UnlinkIcon } from "@lucide/svelte";
  import { STATION_TYPE_COLOR } from "$lib/station-colors";

  let {
    lines,
    unlinkedCount,
    fileName,
    selectedRoute,
    selectedRouteNumber,
    stateLabel,
  }: {
    lines: Line[];
    unlinkedCount: number;
    fileName: string | null;
    selectedRoute: LineRoute | null;
    selectedRouteNumber: number;
    stateLabel: string;
  } = $props();

  const routeCount = $derived(lines.reduce((count, line) => count + line.routes.length, 0));
  const metroCount = $derived(lines.filter((line) => line.type === "metro").length);
  const lightCount = $derived(lines.filter((line) => line.type === "light").length);
</script>

<footer
  class="flex h-7 shrink-0 items-center gap-4 overflow-hidden border-t border-border bg-card px-3 font-mono text-[11px] tabular-nums text-muted-foreground"
>
  <div class="flex min-w-0 items-center gap-1.5">
    <DatabaseIcon class="size-3 shrink-0" />
    <span class="truncate">{fileName ?? "lines.json"}</span>
  </div>
  <span class="text-muted-foreground/40">|</span>
  <div class="hidden items-center gap-3 sm:flex">
    <span
      ><span class="uppercase tracking-wider">Lines</span>
      <span class="text-foreground">{lines.length}</span></span
    >
    <span
      ><span
        class="mr-1.5 inline-block size-1.5 rounded-full align-middle"
        style:background-color={STATION_TYPE_COLOR.metro}
      ></span>{metroCount}</span
    >
    <span
      ><span
        class="mr-1.5 inline-block size-1.5 rounded-full align-middle"
        style:background-color={STATION_TYPE_COLOR.light}
      ></span>{lightCount}</span
    >
    <span
      ><span class="uppercase tracking-wider">Routes</span>
      <span class="text-foreground">{routeCount}</span></span
    >
  </div>
  <span class="hidden text-muted-foreground/40 sm:inline">|</span>
  <div class="hidden items-center gap-1.5 sm:flex">
    <UnlinkIcon class="size-3" />
    <span>{unlinkedCount} unlinked</span>
  </div>

  <div class="ml-auto flex min-w-0 items-center gap-4">
    {#if selectedRoute}
      <div class="hidden min-w-0 items-center gap-1.5 md:flex">
        <RouteIcon class="size-3 shrink-0" />
        <span class="truncate"
          >Route {selectedRoute.code ?? selectedRouteNumber} · {selectedRoute.stations.length} stops</span
        >
      </div>
    {/if}
    <div class="flex items-center gap-1.5">
      <ActivityIcon class="size-3" />
      <span class="uppercase tracking-wider">
        State: <span class="text-foreground">{stateLabel}</span>
      </span>
    </div>
  </div>
</footer>
