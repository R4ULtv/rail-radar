<script lang="ts">
  import type { Station } from "@repo/data";
  import { ActivityIcon, DatabaseIcon, GitBranchIcon, MapPinIcon } from "@lucide/svelte";
  import { STATION_TYPE_COLOR } from "$lib/station-colors";

  let {
    stations,
    selectedStation,
    modifiedCount,
    fileName,
    isAddingStation,
  }: {
    stations: Station[];
    selectedStation: Station | null;
    modifiedCount: number;
    fileName: string | null;
    isAddingStation: boolean;
  } = $props();

  const railCount = $derived(stations.filter((station) => station.type === "rail").length);
  const metroCount = $derived(stations.filter((station) => station.type === "metro").length);
  const lightCount = $derived(stations.filter((station) => station.type === "light").length);
  const stateLabel = $derived.by(() => {
    if (isAddingStation) return "Adding";
    if (selectedStation && !selectedStation.geo) return "Placing";
    if (selectedStation) return "Editing";
    return "Browse";
  });
</script>

<footer
  class="flex h-7 shrink-0 items-center gap-4 overflow-hidden border-t border-border bg-card px-3 font-mono text-[11px] tabular-nums text-muted-foreground"
>
  <div class="flex min-w-0 items-center gap-1.5">
    <DatabaseIcon class="size-3 shrink-0" />
    <span class="truncate">{fileName ?? "untitled.geojson"}</span>
  </div>
  <span class="text-muted-foreground/40">|</span>
  <div class="hidden items-center gap-3 sm:flex">
    <span
      ><span class="uppercase tracking-wider">Total</span>
      <span class="text-foreground">{stations.length}</span></span
    >
    <span
      ><span
        class="mr-1.5 inline-block size-1.5 rounded-full align-middle"
        style:background-color={STATION_TYPE_COLOR.rail}
      ></span>{railCount}</span
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
  </div>
  <span class="hidden text-muted-foreground/40 sm:inline">|</span>
  <div class="hidden items-center gap-1.5 sm:flex">
    <GitBranchIcon class="size-3" />
    <span>{modifiedCount} changed</span>
  </div>

  <div class="ml-auto flex min-w-0 items-center gap-4">
    {#if selectedStation?.geo}
      <div class="hidden min-w-0 items-center gap-1.5 md:flex">
        <MapPinIcon class="size-3 shrink-0" />
        <span class="truncate"
          >{selectedStation.geo.lat.toFixed(5)}, {selectedStation.geo.lng.toFixed(5)}</span
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
