<script lang="ts">
  import type { Station } from "@repo/data";
  import { onMount, tick } from "svelte";
  import {
    CopyIcon,
    ListIcon,
    SearchIcon,
    SquareMIcon,
    TramFrontIcon,
    XIcon,
  } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import * as Tabs from "$lib/components/ui/tabs";
  import type { ChangeType } from "$lib/types/contribution";
  import { cn } from "$lib/utils";

  type FilterType = "all" | "metro" | "light" | "duplicate";
  const ROW_HEIGHT = 36;
  const OVERSCAN = 12;

  let {
    stations,
    selectedStationId,
    changedStationIds,
    onSelectStation,
  }: {
    stations: Station[];
    selectedStationId: string | null;
    changedStationIds: Map<string, ChangeType>;
    onSelectStation: (id: string) => void;
  } = $props();

  let search = $state("");
  let filter = $state<FilterType>("all");
  let scrollTop = $state(0);
  let viewportHeight = $state(0);
  let scrollContainer = $state<HTMLElement | null>(null);
  let searchInput = $state<HTMLInputElement | null>(null);
  let lastFilterKey = $state("");

  let filteredStations = $derived.by(() => {
    let result = stations;
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter((station) => station.name.toLowerCase().includes(lower));
    }

    if (filter === "metro") result = result.filter((station) => station.type === "metro");
    if (filter === "light") result = result.filter((station) => station.type === "light");
    if (filter === "duplicate") {
      const nameCounts = new Map<string, number>();
      const geoCounts = new Map<string, number>();
      for (const station of stations) {
        const name = station.name.toLowerCase();
        nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
        if (station.geo) {
          const key = `${station.geo.lat},${station.geo.lng}`;
          geoCounts.set(key, (geoCounts.get(key) ?? 0) + 1);
        }
      }

      result = result.filter((station) => {
        const duplicateName = (nameCounts.get(station.name.toLowerCase()) ?? 0) > 1;
        const duplicateGeo =
          station.geo && (geoCounts.get(`${station.geo.lat},${station.geo.lng}`) ?? 0) > 1;
        return duplicateName || duplicateGeo;
      });
    }

    return result;
  });
  const totalHeight = $derived(filteredStations.length * ROW_HEIGHT);
  const startIndex = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN));
  const visibleCount = $derived(Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2);
  const visibleStations = $derived(filteredStations.slice(startIndex, startIndex + visibleCount));
  const offsetY = $derived(startIndex * ROW_HEIGHT);

  $effect(() => {
    const filterKey = `${search}\u0000${filter}`;
    if (filterKey === lastFilterKey) return;
    lastFilterKey = filterKey;
    scrollTop = 0;
    if (scrollContainer) scrollContainer.scrollTop = 0;
  });

  $effect(() => {
    const viewport = scrollContainer;
    if (!viewport) return;

    const syncScrollMetrics = () => {
      scrollTop = viewport.scrollTop;
      viewportHeight = viewport.clientHeight;
    };
    const resizeObserver = new ResizeObserver(syncScrollMetrics);

    syncScrollMetrics();
    resizeObserver.observe(viewport);
    viewport.addEventListener("scroll", syncScrollMetrics, {
      passive: true,
    });

    return () => {
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", syncScrollMetrics);
    };
  });

  onMount(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (inField) return;
      if ((!event.metaKey && !event.ctrlKey) || event.key.toLowerCase() !== "k") return;

      event.preventDefault();
      searchInput?.focus();
      searchInput?.select();
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  function changeClass(changeType: ChangeType | undefined): string {
    if (changeType === "created") return "bg-green-500";
    if (changeType === "updated") return "bg-blue-500";
    if (changeType === "deleted") return "bg-red-500";
    return "";
  }

  function scrollStationIntoView(index: number) {
    if (!scrollContainer) return;

    const rowTop = index * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const viewportTop = scrollContainer.scrollTop;
    const viewportBottom = viewportTop + scrollContainer.clientHeight;

    if (rowTop < viewportTop) {
      scrollContainer.scrollTop = rowTop;
    } else if (rowBottom > viewportBottom) {
      scrollContainer.scrollTop = rowBottom - scrollContainer.clientHeight;
    }
  }

  async function focusStationButton(stationId: string) {
    await tick();
    scrollContainer
      ?.querySelector<HTMLButtonElement>(`[data-station-id="${CSS.escape(stationId)}"]`)
      ?.focus();
  }

  function handleStationKeydown(event: KeyboardEvent, stationId: string) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const currentIndex = filteredStations.findIndex((station) => station.id === stationId);
    if (currentIndex === -1) return;

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = Math.min(filteredStations.length - 1, Math.max(0, currentIndex + direction));
    const nextStation = filteredStations[nextIndex];
    if (!nextStation) return;

    event.preventDefault();
    scrollStationIntoView(nextIndex);
    onSelectStation(nextStation.id);
    void focusStationButton(nextStation.id);
  }
</script>

<aside
  class="flex h-full w-72 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground max-lg:w-[18rem] max-md:hidden"
>
  <div class="flex shrink-0 flex-col gap-3 border-b border-sidebar-border p-3">
    <div class="flex items-baseline justify-between">
      <h2 class="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Stations</h2>
      <span class="font-mono text-[11px] tabular-nums text-muted-foreground">
        {filteredStations.length}
        <span class="text-muted-foreground/60"> / {stations.length}</span>
      </span>
    </div>
    <div class="relative">
      <SearchIcon
        class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        bind:ref={searchInput}
        class="w-full pl-9"
        placeholder="Search stations..."
        bind:value={search}
      />
      {#if search}
        <Button
          variant="ghost"
          size="icon-xs"
          class="absolute right-2 top-1/2 -translate-y-1/2"
          onclick={() => (search = "")}
        >
          <XIcon class="size-3" />
        </Button>
      {/if}
    </div>

    <Tabs.Root bind:value={filter} class="gap-0">
      <Tabs.List class="flex h-8 w-full">
        <Tabs.Trigger value="all" title="All stations" class="gap-1.5">
          <ListIcon class="size-3" />
          {#if filter === "all"}<span class="text-xs">All</span>{/if}
        </Tabs.Trigger>
        <Tabs.Trigger value="metro" title="Metro" class="gap-1.5">
          <SquareMIcon class="size-3" />
          {#if filter === "metro"}<span class="text-xs">Metro</span>{/if}
        </Tabs.Trigger>
        <Tabs.Trigger value="light" title="Light rail" class="gap-1.5">
          <TramFrontIcon class="size-3" />
          {#if filter === "light"}<span class="text-xs">Light</span>{/if}
        </Tabs.Trigger>
        <Tabs.Trigger value="duplicate" title="Duplicates" class="gap-1.5">
          <CopyIcon class="size-3" />
          {#if filter === "duplicate"}<span class="text-xs">Duplicates</span>{/if}
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
  </div>

  <ScrollArea bind:viewportRef={scrollContainer} class="min-h-0 flex-1">
    {#if filteredStations.length === 0}
      <div class="px-4 py-8 text-center text-xs text-muted-foreground">
        No stations match your filters.
      </div>
    {:else}
      <div class="relative" style:height={`${totalHeight}px`}>
        <div class="absolute inset-x-0 top-0" style:transform={`translateY(${offsetY}px)`}>
          {#each visibleStations as station (station.id)}
            {@const changeType = changedStationIds.get(station.id)}
            <Button
              data-station-id={station.id}
              variant="ghost"
              size="sm"
              class={cn(
                "h-9 w-full justify-start rounded-none border-l-2 border-l-transparent px-3 text-left text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                selectedStationId === station.id && "bg-muted text-foreground",
                selectedStationId === station.id && "border-l-primary",
              )}
              onclick={() => onSelectStation(station.id)}
              onkeydown={(event) => handleStationKeydown(event, station.id)}
            >
              <span class="relative flex items-center justify-center">
                <span class="block size-2 rounded-full bg-green-500"></span>
                {#if changeType}
                  <span
                    class={`absolute -right-0.5 -top-0.5 size-1.5 rounded-full ring-2 ring-card ${changeClass(changeType)}`}
                  ></span>
                {/if}
              </span>
              <span class="min-w-0 flex-1 truncate">{station.name}</span>
              {#if station.type === "metro"}<SquareMIcon
                  class="size-3 text-muted-foreground"
                />{/if}
              {#if station.type === "light"}<TramFrontIcon
                  class="size-3 text-muted-foreground"
                />{/if}
            </Button>
          {/each}
        </div>
      </div>
    {/if}
  </ScrollArea>
</aside>
