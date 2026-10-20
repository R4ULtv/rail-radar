<script lang="ts">
  import type { Line, LineGeometry, Station } from "@repo/data";
  import { validateLineGeometry } from "@repo/data/lines";
  import {
    ArrowDownIcon,
    ArrowUpIcon,
    MapPinIcon,
    PlusIcon,
    SaveIcon,
    Trash2Icon,
    XIcon,
  } from "@lucide/svelte";
  import LineBadge from "$lib/components/LineBadge.svelte";
  import { DEFAULT_LINE_COLOR } from "$lib/line-colors";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import * as Select from "$lib/components/ui/select";

  let {
    draft = $bindable(),
    draftGeometry = $bindable(),
    routeIndex = $bindable(0),
    geometryEditing = $bindable(false),
    geometryEditable,
    stations,
    dirty,
    saving,
    error,
    isNew,
    onSave,
    onDelete,
    onClose,
    onFocusStation,
  }: {
    draft: Line;
    draftGeometry: LineGeometry;
    routeIndex: number;
    geometryEditable: boolean;
    stations: Station[];
    dirty: boolean;
    saving: boolean;
    error: string | null;
    isNew: boolean;
    geometryEditing: boolean;
    onSave: () => void;
    onDelete: () => void;
    onClose: () => void;
    onFocusStation: (id: string) => void;
  } = $props();
  let query = $state("");
  let geometryText = $state<string | null>(null);
  let geometryError = $state<string | null>(null);
  const stationById = $derived(new Map(stations.map((station) => [station.id, station])));
  const activeRoute = $derived(draft.routes[routeIndex] ?? draft.routes[0]);
  // Rings and loops revisit stops, so only an immediate repeat is blocked.
  const activeStopIds = $derived(new Set(activeRoute?.stations));
  const activeLastStop = $derived(activeRoute?.stations.at(-1));
  // Renaming moves the line's track file, which only local mode can write.
  const idLocked = $derived(!isNew && !geometryEditable);
  // Saving trims and uppercases, so only the hex itself is checked here.
  const colorValid = $derived(draft.color === null || /^#[\da-f]{6}$/i.test(draft.color.trim()));
  const matches = $derived(
    query.trim().length < 2
      ? []
      : stations
          .filter((station) =>
            `${station.id} ${station.name}`
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase()),
          )
          .slice(0, 15),
  );
  $effect(() => {
    geometryEditing = geometryText !== null;
  });

  function chooseRoute(index: number) {
    routeIndex = index;
    query = "";
  }
  function addRoute() {
    draft.routes.push({ stations: [] });
    routeIndex = draft.routes.length - 1;
  }
  function moveStop(index: number, offset: number) {
    if (!activeRoute) return;
    const stops = [...activeRoute.stations];
    const other = index + offset;
    [stops[index], stops[other]] = [stops[other]!, stops[index]!];
    activeRoute.stations = stops;
  }
  function applyGeometry() {
    if (geometryText === null) return;
    try {
      draftGeometry = validateLineGeometry(JSON.parse(geometryText), draft.id || "Line");
      geometryText = null;
      geometryError = null;
    } catch (error) {
      geometryError = error instanceof Error ? error.message : "Invalid geometry";
    }
  }
</script>

<aside
  class="flex h-full w-[24rem] shrink-0 flex-col border-l border-border bg-card text-card-foreground max-lg:w-88 max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-20 max-md:max-w-[calc(100vw-2rem)]"
  aria-label="Line editor"
>
  <div class="border-b border-border px-4 py-3">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {isNew ? "New line" : "Inspector"}
        </div>
        <h2 class="mt-1 flex min-w-0 items-center gap-2 text-sm font-semibold">
          <LineBadge line={draft} />
          <span class="truncate">{draft.name || "Unnamed line"}</span>
        </h2>
        <p class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {draft.id || "No ID"}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Close line editor"
        disabled={saving}
        onclick={onClose}
      >
        <XIcon class="size-4" />
      </Button>
    </div>
  </div>
  <ScrollArea class="min-h-0 flex-1">
    <fieldset disabled={saving} class="min-w-0 px-4 py-4 disabled:opacity-60">
      <div class="flex flex-col gap-4">
        <div class="space-y-1.5">
          <Label for="line-name">Name</Label><Input id="line-name" bind:value={draft.name} />
        </div>
        <div class="space-y-1.5">
          <Label for="line-id">Line ID</Label>
          <p class="text-xs text-muted-foreground">
            {idLocked
              ? "Renaming moves the track file, so it needs local mode"
              : "Country, network, then code or short name"}
          </p>
          <Input
            id="line-id"
            bind:value={draft.id}
            class="font-mono"
            placeholder="it-milano-m1"
            disabled={idLocked}
          />
        </div>
        <div class="space-y-1.5">
          <Label for="line-description">Description</Label>
          <p class="text-xs text-muted-foreground">English overview for the line's page</p>
          <textarea
            id="line-description"
            rows="4"
            class="w-full min-w-0 resize-y rounded-none border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30"
            placeholder="Optional"
            value={draft.description ?? ""}
            oninput={(event) => {
              const value = event.currentTarget.value;
              if (value.trim()) draft.description = value;
              else delete draft.description;
            }}></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label for="line-code">Public code</Label><Input
              id="line-code"
              value={draft.code ?? ""}
              oninput={(event) => (draft.code = event.currentTarget.value || null)}
              placeholder="M1, A, T1..."
            />
          </div>
          <div class="space-y-1.5">
            <Label for="line-type">Type</Label>
            <Select.Root type="single" bind:value={draft.type} disabled={saving}>
              <Select.Trigger id="line-type" class="w-full">
                {draft.type === "metro" ? "Metro" : "Light rail"}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="metro">Metro</Select.Item>
                <Select.Item value="light">Light rail</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
        </div>
        <div class="space-y-1.5">
          <Label for="line-operator">Operator</Label><Input
            id="line-operator"
            class="font-mono"
            placeholder="operators.json slug, e.g. atm-milano"
            value={draft.operator ?? ""}
            oninput={(event) => (draft.operator = event.currentTarget.value || null)}
          />
        </div>
        <div class="space-y-1.5">
          <Label for="line-color">Color</Label>
          <div class="flex items-center gap-2">
            <label
              class="relative size-8 shrink-0 cursor-pointer border border-border"
              style:background-color={colorValid && draft.color
                ? draft.color.trim()
                : DEFAULT_LINE_COLOR}
              title="Pick color"
            >
              <input
                type="color"
                class="absolute inset-0 size-full cursor-pointer opacity-0"
                aria-label="Pick line color"
                value={colorValid && draft.color ? draft.color.trim() : DEFAULT_LINE_COLOR}
                oninput={(event) => (draft.color = event.currentTarget.value.toUpperCase())}
              />
            </label><Input
              id="line-color"
              class="font-mono"
              value={draft.color ?? ""}
              oninput={(event) => (draft.color = event.currentTarget.value || null)}
              placeholder="#RRGGBB, empty for none"
              aria-invalid={!colorValid}
              aria-describedby={colorValid ? undefined : "line-color-error"}
            />
          </div>
          {#if !colorValid}
            <p id="line-color-error" class="text-xs text-destructive">
              Use a #RRGGBB hex color, e.g. #E30613
            </p>
          {/if}
        </div>

        <section class="border-t border-border pt-4" aria-label="Routes and stops">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-xs font-semibold">Routes / branches · {draft.routes.length}</h3>
            <Button variant="outline" size="xs" onclick={addRoute}
              ><PlusIcon class="size-3" />Add route</Button
            >
          </div>
          <div class="mb-3 flex flex-wrap gap-1" aria-label="Select route">
            {#each draft.routes as route, index}
              <Button
                size="xs"
                variant={activeRoute === route ? "default" : "outline"}
                title={route.stations.length >= 2
                  ? `${stationById.get(route.stations[0]!)?.name} → ${stationById.get(route.stations.at(-1)!)?.name}`
                  : "New route"}
                onclick={() => chooseRoute(index)}>{route.code ?? index + 1}</Button
              >
            {/each}
          </div>
          {#if activeRoute}
            <div class="mb-3 space-y-1.5">
              <Label for="route-code">Route code</Label>
              <Input
                id="route-code"
                value={activeRoute.code ?? ""}
                placeholder="Optional, e.g. 10 or 11"
                oninput={(event) => {
                  if (!activeRoute) return;
                  const value = event.currentTarget.value;
                  if (value) activeRoute.code = value;
                  else delete activeRoute.code;
                }}
              />
            </div>
            <div class="mb-2 flex items-center justify-between gap-2">
              <p class="min-w-0 truncate text-xs text-muted-foreground">
                {#if activeRoute.stations.length >= 2}{stationById.get(activeRoute.stations[0]!)
                    ?.name} → {stationById.get(activeRoute.stations.at(-1)!)?.name}{:else}Add at
                  least two stops{/if}
              </p>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove route"
                disabled={draft.routes.length < 2}
                onclick={() => {
                  if (window.confirm(`Remove route ${activeRoute?.code ?? routeIndex + 1}?`)) {
                    draft.routes = draft.routes.filter((route) => route !== activeRoute);
                    routeIndex = 0;
                  }
                }}><Trash2Icon class="size-3.5" /></Button
              >
            </div>
            <p class="mb-3 text-[11px] text-muted-foreground">
              {activeRoute.stations.length} stops in travel order. Opposite directions share this route;
              short trips within another route are not listed.
            </p>
            <ol class="border border-border" aria-label="Ordered stops">
              {#each activeRoute.stations as id, index}
                <li
                  class="group flex items-center gap-2 border-b border-border px-2 py-2 last:border-0"
                >
                  <span class="w-4 shrink-0 text-right font-mono text-[10px] text-muted-foreground"
                    >{index + 1}</span
                  >
                  <button
                    class="min-w-0 flex-1 text-left"
                    type="button"
                    onclick={() => onFocusStation(id)}
                    title={`${stationById.get(id)?.name ?? id} · Show station on map`}
                    ><span class="block truncate text-xs">{stationById.get(id)?.name ?? id}</span
                    ><span class="block font-mono text-[10px] text-muted-foreground">{id}</span
                    ></button
                  >
                  <div class="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Move stop ${index + 1} up`}
                      disabled={index === 0}
                      onclick={() => moveStop(index, -1)}><ArrowUpIcon class="size-3" /></Button
                    >
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Move stop ${index + 1} down`}
                      disabled={index === activeRoute.stations.length - 1}
                      onclick={() => moveStop(index, 1)}><ArrowDownIcon class="size-3" /></Button
                    >
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove stop ${index + 1}`}
                      onclick={() => {
                        activeRoute.stations = activeRoute.stations.filter(
                          (_, position) => position !== index,
                        );
                      }}><XIcon class="size-3" /></Button
                    >
                  </div>
                </li>
              {/each}
            </ol>
            <div class="mt-3 space-y-1.5">
              <Label for="stop-search">Add existing station</Label><Input
                id="stop-search"
                bind:value={query}
                placeholder="Search name or station ID..."
              />
            </div>
            {#if query.trim().length >= 2}
              <ScrollArea
                class="mt-1 border border-border"
                style={`height: ${Math.max(1, Math.min(matches.length, 4)) * 48}px`}
                aria-label="Station search results"
              >
                {#each matches as station}
                  {@const onRoute = activeStopIds.has(station.id)}
                  {@const isLastStop = station.id === activeLastStop}
                  <button
                    type="button"
                    class="flex h-12 w-full min-w-0 items-center gap-2 border-b border-border px-2 py-2 text-left last:border-0 hover:bg-muted disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
                    title={isLastStop
                      ? `${station.name} is already the last stop`
                      : onRoute
                        ? `${station.name} is already on this route; add it again for a ring or loop`
                        : `${station.name}\n${station.id}`}
                    disabled={isLastStop}
                    onclick={() => {
                      activeRoute.stations.push(station.id);
                      query = "";
                    }}
                    ><MapPinIcon class="size-3 shrink-0 text-muted-foreground" /><span
                      class="min-w-0 flex-1"
                      ><span class="block truncate text-xs">{station.name}</span><span
                        class="block font-mono text-[10px] text-muted-foreground">{station.id}</span
                      ></span
                    >{#if onRoute}<span
                        class="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                        >On route</span
                      >{/if}</button
                  >
                {:else}<p class="p-3 text-xs text-muted-foreground">No matching stations.</p>{/each}
              </ScrollArea>
            {/if}
          {/if}
        </section>

        <section class="border-t border-border pt-4" aria-label="Track geometry">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-semibold">
              Track · {draftGeometry.coordinates.reduce(
                (count, segment) => count + segment.length,
                0,
              )} points
            </h3>
            {#if geometryEditable}<Button
                variant="outline"
                size="xs"
                onclick={() => {
                  geometryText = JSON.stringify(draftGeometry);
                  geometryError = null;
                }}>Edit geometry</Button
              >{/if}
          </div>
          <p class="mt-1 text-[11px] text-muted-foreground">
            One track for every route, saved to lines/{draft.id || "…"}.json.
            {#if !geometryEditable}Edit track in local mode.{/if}
          </p>
          {#if geometryText !== null}
            <Label for="line-geometry" class="mt-3 block">GeoJSON MultiLineString</Label>
            <textarea
              id="line-geometry"
              bind:value={geometryText}
              class="mt-2 h-40 w-full border border-input bg-background p-2 font-mono text-[11px]"
              spellcheck="false"></textarea>
            {#if geometryError}<p role="alert" class="mt-2 text-xs text-destructive">
                {geometryError}
              </p>{/if}
            <div class="mt-2 flex gap-2">
              <Button size="xs" onclick={applyGeometry}>Apply geometry</Button><Button
                size="xs"
                variant="ghost"
                onclick={() => {
                  geometryText = null;
                  geometryError = null;
                }}>Cancel geometry edit</Button
              >
            </div>
          {/if}
        </section>
      </div>
    </fieldset>
  </ScrollArea>
  <div class="border-t border-border bg-card px-4 py-3">
    {#if error}<p role="alert" class="mb-3 text-xs text-destructive">{error}</p>{/if}
    {#if geometryText !== null}<p class="mb-2 text-xs text-muted-foreground">
        Apply or cancel the geometry edit before saving.
      </p>{/if}
    <div class="grid grid-cols-[1fr_auto] gap-2">
      <Button
        class={isNew ? "col-span-2" : undefined}
        disabled={!dirty || saving || geometryText !== null}
        onclick={onSave}
      >
        <SaveIcon class="size-4" />
        {saving ? "Saving..." : "Save line"}
      </Button>
      {#if !isNew}
        <Button variant="destructive" disabled={saving} onclick={onDelete}>
          <Trash2Icon class="size-4" />
          Delete
        </Button>
      {/if}
    </div>
  </div>
</aside>
