<script lang="ts">
  import type { Line, Station } from "@repo/data";
  import { getLineStationIds } from "@repo/data/lines";
  import {
    ListIcon,
    RouteIcon,
    SearchIcon,
    SquareMIcon,
    TramFrontIcon,
    UnlinkIcon,
    XIcon,
  } from "@lucide/svelte";
  import { onMount, tick } from "svelte";
  import LineBadge from "$lib/components/LineBadge.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import * as Tabs from "$lib/components/ui/tabs";
  import { cn } from "$lib/utils";

  const ROW_HEIGHT = 36;
  const OVERSCAN = 4;

  let {
    lines,
    filteredLines,
    unlinked,
    filteredUnlinked,
    selectedLineId,
    focusedStationId,
    search = $bindable(""),
    typeFilter = $bindable("all"),
    showUnlinked = $bindable(false),
    onSelectLine,
    onFocusStation,
  }: {
    lines: Line[];
    filteredLines: Line[];
    unlinked: Station[];
    filteredUnlinked: Station[];
    selectedLineId: string | null;
    focusedStationId: string | null;
    search?: string;
    typeFilter?: string;
    showUnlinked?: boolean;
    onSelectLine: (id: string) => void;
    onFocusStation: (id: string) => void;
  } = $props();

  let scrollTop = $state(0);
  let viewportHeight = $state(0);
  let scrollContainer = $state<HTMLElement | null>(null);
  let searchInput = $state<HTMLInputElement | null>(null);
  let lastFilterKey = $state("");

  const items = $derived<(Line | Station)[]>(showUnlinked ? filteredUnlinked : filteredLines);
  const total = $derived(showUnlinked ? unlinked.length : lines.length);
  const selectedId = $derived(showUnlinked ? focusedStationId : selectedLineId);
  const totalHeight = $derived(items.length * ROW_HEIGHT);
  const visibleCount = $derived(Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2);
  const startIndex = $derived(
    Math.min(
      Math.max(0, items.length - visibleCount),
      Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN),
    ),
  );
  const visibleItems = $derived(items.slice(startIndex, startIndex + visibleCount));

  $effect(() => {
    const key = `${search}\u0000${typeFilter}\u0000${showUnlinked}`;
    if (key === lastFilterKey) return;
    lastFilterKey = key;
    scrollTop = 0;
    if (scrollContainer) scrollContainer.scrollTop = 0;
  });

  $effect(() => {
    const viewport = scrollContainer;
    if (!viewport) return;
    const syncMetrics = () => {
      scrollTop = viewport.scrollTop;
      viewportHeight = viewport.clientHeight;
    };
    const observer = new ResizeObserver(syncMetrics);
    syncMetrics();
    observer.observe(viewport);
    viewport.addEventListener("scroll", syncMetrics, { passive: true });
    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", syncMetrics);
    };
  });

  onMount(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea") || target?.isContentEditable) return;
      if ((!event.metaKey && !event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      searchInput?.focus();
      searchInput?.select();
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  const foldText = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase();

  /** The ID's network segment (brussels, milano), unless the name already says it. */
  function getNetworkLabel(line: Line): string | null {
    const network = line.id.split("-")[1];
    return network && !foldText(line.name).includes(network) ? network : null;
  }

  function selectItem(item: Line | Station) {
    if ("routes" in item) onSelectLine(item.id);
    else onFocusStation(item.id);
  }

  async function handleRowKeydown(event: KeyboardEvent, id: string) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : Math.min(items.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)));
    const item = items[nextIndex];
    if (!item) return;
    selectItem(item);
    await tick();
    // A cancelled discard dialog leaves the selection and keyboard focus in place.
    if (selectedId !== item.id || !scrollContainer) return;
    const top = nextIndex * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < scrollContainer.scrollTop) scrollContainer.scrollTop = top;
    else if (bottom > scrollContainer.scrollTop + scrollContainer.clientHeight)
      scrollContainer.scrollTop = bottom - scrollContainer.clientHeight;
    scrollTop = scrollContainer.scrollTop;
    await tick();
    scrollContainer
      .querySelector<HTMLButtonElement>(`[data-line-sidebar-id="${CSS.escape(item.id)}"]`)
      ?.focus({ preventScroll: true });
  }
</script>

<aside
  class="flex h-full w-72 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground max-lg:w-[18rem] max-md:hidden"
  aria-label="Lines sidebar"
>
  <div class="flex shrink-0 flex-col gap-3 border-b border-sidebar-border p-3">
    <div class="flex items-baseline justify-between">
      <h2 class="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {showUnlinked ? "Unlinked stations" : "Lines"}
      </h2>
      <span class="font-mono text-[11px] tabular-nums text-muted-foreground">
        {items.length}
        <span class="text-muted-foreground/60"> / {total}</span>
      </span>
    </div>

    <Tabs.Root
      bind:value={
        () => (showUnlinked ? "unlinked" : "lines"),
        (value) => (showUnlinked = value === "unlinked")
      }
      class="gap-0"
    >
      <Tabs.List class="flex h-8 w-full" aria-label="Sidebar view">
        <Tabs.Trigger value="lines" class="gap-1.5">
          <RouteIcon class="size-3" />
          <span class="text-xs">Lines</span>
          <span class="font-mono text-[10px] text-muted-foreground">{lines.length}</span>
        </Tabs.Trigger>
        <Tabs.Trigger value="unlinked" class="gap-1.5" title="Stations with no line assigned">
          <UnlinkIcon class="size-3" />
          <span class="text-xs">Unlinked</span>
          <span class="font-mono text-[10px] text-muted-foreground">{unlinked.length}</span>
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>

    <div class="relative">
      <SearchIcon
        class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        bind:ref={searchInput}
        bind:value={search}
        aria-label={showUnlinked ? "Search stations" : "Search lines"}
        class="w-full pl-9 pr-20"
        placeholder={showUnlinked ? "Search by name or ID..." : "Line, station, operator..."}
      />
      {#if search}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Clear search"
          class="absolute right-2 top-1/2 -translate-y-1/2"
          onclick={() => (search = "")}
        >
          <XIcon class="size-3" />
        </Button>
      {:else}
        <kbd
          class="pointer-events-none absolute right-2 top-1/2 inline-flex h-5 min-w-5 -translate-y-1/2 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none"
        >
          ⌘K
        </kbd>
      {/if}
    </div>

    <Tabs.Root bind:value={typeFilter} class="gap-0">
      <Tabs.List class="flex h-8 w-full" aria-label="Filter transport type">
        <Tabs.Trigger value="all" title="All transport types" class="gap-1.5">
          <ListIcon class="size-3" />
          {#if typeFilter === "all"}<span class="text-xs">All</span>{/if}
        </Tabs.Trigger>
        <Tabs.Trigger value="metro" title="Metro" class="gap-1.5">
          <SquareMIcon class="size-3" />
          {#if typeFilter === "metro"}<span class="text-xs">Metro</span>{/if}
        </Tabs.Trigger>
        <Tabs.Trigger value="light" title="Light rail" class="gap-1.5">
          <TramFrontIcon class="size-3" />
          {#if typeFilter === "light"}<span class="text-xs">Light</span>{/if}
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>

    {#if showUnlinked}
      <p class="text-[11px] leading-4 text-muted-foreground">
        Metro and light rail stations with no line assigned. Open a line, select a station here,
        then use Add to route on its card.
      </p>
    {/if}
  </div>

  <ScrollArea bind:viewportRef={scrollContainer} class="min-h-0 flex-1">
    {#if items.length === 0}
      <div class="px-4 py-8 text-center text-xs text-muted-foreground">
        No {showUnlinked ? "stations" : "lines"} match your filters.
      </div>
    {:else}
      <div
        class="relative"
        style:height={`${totalHeight}px`}
        role="list"
        aria-label={showUnlinked ? "Unlinked stations" : "Transit lines"}
      >
        <div
          class="absolute inset-x-0 top-0"
          style:transform={`translateY(${startIndex * ROW_HEIGHT}px)`}
        >
          {#each visibleItems as item, index (item.id)}
            {@const line = "routes" in item ? item : null}
            <div role="listitem" aria-posinset={startIndex + index + 1} aria-setsize={items.length}>
              <Button
                data-line-sidebar-id={item.id}
                variant="ghost"
                size="sm"
                class={cn(
                  "h-9 w-full min-w-0 justify-start gap-2 rounded-none border-l-2 border-l-transparent px-3 text-left text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                  selectedId === item.id && "border-l-primary bg-muted text-foreground",
                )}
                aria-pressed={selectedId === item.id}
                title={line
                  ? `${line.name}\n${line.operator ?? line.id}\n${line.routes.length} routes · ${getLineStationIds(line).length} stops`
                  : `${item.name}\n${item.id}`}
                onclick={() => selectItem(item)}
                onkeydown={(event) => handleRowKeydown(event, item.id)}
              >
                {#if line}
                  <LineBadge {line} />
                {:else}
                  <span class="block size-2 shrink-0 rounded-full bg-green-500"></span>
                {/if}
                <span class="min-w-0 flex-1 truncate">{item.name}</span>
                {#if line}
                  {@const network = getNetworkLabel(line)}
                  {#if network}
                    <span
                      class="max-w-20 shrink-0 truncate font-mono text-[10px] text-muted-foreground/70"
                      >{network}</span
                    >
                  {/if}
                {/if}
                {#if item.type === "metro"}
                  <SquareMIcon class="size-3 shrink-0 text-muted-foreground" />
                {:else if item.type === "light"}
                  <TramFrontIcon class="size-3 shrink-0 text-muted-foreground" />
                {/if}
              </Button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </ScrollArea>
</aside>
