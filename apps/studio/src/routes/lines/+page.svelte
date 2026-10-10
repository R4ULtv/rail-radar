<script lang="ts">
  import type { Line, LineGeometry, Station } from "@repo/data";
  import {
    createLineIndex,
    getLineStationIds,
    validateLineGeometry,
    validateLines,
  } from "@repo/data/lines";
  import { beforeNavigate } from "$app/navigation";
  import { CheckIcon, PlusIcon, XIcon } from "@lucide/svelte";
  import { onMount } from "svelte";
  import LineBadge from "$lib/components/LineBadge.svelte";
  import LineEditPanel from "$lib/components/LineEditPanel.svelte";
  import LineHeaderBar from "$lib/components/LineHeaderBar.svelte";
  import LineMap from "$lib/components/LineMap.svelte";
  import LineSidebar from "$lib/components/LineSidebar.svelte";
  import LineStatusBar from "$lib/components/LineStatusBar.svelte";
  import { Button } from "$lib/components/ui/button";
  import { emptyGeometry, loadBundledGeometries } from "$lib/line-geometry";
  import type { DataMode } from "$lib/stores/stations";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  let lines = $state.raw<Line[]>([]);
  let geometries = $state.raw<Map<string, LineGeometry>>(new Map());
  let stations = $state.raw<Station[]>([]);
  let mode = $state<DataMode>("browser");
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let saveError = $state<string | null>(null);
  let saving = $state(false);
  // Browser-mode saves live in memory until lines.json is exported.
  let unexported = $state(false);
  let toastMessage = $state<string | null>(null);
  let fileName = $state<string | null>(null);
  let original = $state.raw<Line | null>(null);
  let draft = $state<Line | null>(null);
  let draftGeometry = $state.raw<LineGeometry>(emptyGeometry());
  let geometryEditing = $state(false);
  let editSession = $state(0);
  let routeIndex = $state(0);
  let focusedStationId = $state<string | null>(null);
  let search = $state("");
  let typeFilter = $state("all");
  let showUnlinked = $state(false);
  const stationById = $derived(new Map(stations.map((station) => [station.id, station])));
  const stationIds = $derived(new Set(stationById.keys()));
  const index = $derived(createLineIndex(lines));
  const originalGeometry = $derived(
    original ? (geometries.get(original.id) ?? emptyGeometry()) : emptyGeometry(),
  );
  const dirty = $derived(
    geometryEditing ||
      (draft !== null &&
        (JSON.stringify(draft) !== JSON.stringify(original) ||
          JSON.stringify(draftGeometry) !== JSON.stringify(originalGeometry))),
  );
  const searchByLineId = $derived(
    new Map(
      lines.map((line) => [
        line.id,
        `${line.id} ${line.name} ${line.code ?? ""} ${line.routes.map((route) => route.code ?? "").join(" ")} ${line.operator ?? ""} ${getLineStationIds(
          line,
        )
          .map((id) => `${id} ${stationById.get(id)?.name ?? ""}`)
          .join(" ")}`.toLocaleLowerCase(),
      ]),
    ),
  );
  const filteredLines = $derived(
    lines.filter(
      (line) =>
        (typeFilter === "all" || line.type === typeFilter) &&
        searchByLineId.get(line.id)!.includes(search.trim().toLocaleLowerCase()),
    ),
  );
  const mapLines = $derived(
    draft ? [...filteredLines.filter((line) => line.id !== original?.id), draft] : filteredLines,
  );
  // The draft's track is shown under its current ID, including while the ID is being edited.
  const mapGeometries = $derived(
    draft ? new Map([...geometries, [draft.id, draftGeometry]]) : geometries,
  );
  const countries = $derived(new Set(lines.map((line) => line.id.slice(0, 2).toUpperCase())));
  const unlinked = $derived(
    stations.filter(
      (station) =>
        station.type !== "rail" &&
        countries.has(station.id.slice(0, 2)) &&
        !index.getStationLines(station.id).length,
    ),
  );
  const filteredUnlinked = $derived(
    unlinked.filter(
      (station) =>
        `${station.id} ${station.name}`
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()) &&
        (typeFilter === "all" || station.type === typeFilter),
    ),
  );
  const focusedStation = $derived(focusedStationId ? stationById.get(focusedStationId) : null);
  const selectedRoute = $derived(draft ? (draft.routes[routeIndex] ?? null) : null);
  // Rings and loops revisit stops, so only an immediate repeat is blocked.
  const focusedOnRoute = $derived(
    !!focusedStationId && !!selectedRoute?.stations.includes(focusedStationId),
  );
  const focusedIsLastStop = $derived(
    !!focusedStationId && selectedRoute?.stations.at(-1) === focusedStationId,
  );
  const stateLabel = $derived(!draft ? "Browse" : original ? "Editing" : "Adding");

  function showToast(text: string) {
    toastMessage = text;
    window.setTimeout(() => {
      if (toastMessage === text) toastMessage = null;
    }, 2200);
  }

  function discardDraft() {
    return !dirty || window.confirm("Discard unsaved line changes?");
  }
  /** Leaving the loaded dataset also loses browser saves that were never exported. */
  function discardWorkspace() {
    if (unexported) {
      return window.confirm(
        "Lines saved in this browser haven't been exported. Discard them and any unsaved changes?",
      );
    }
    return discardDraft();
  }
  beforeNavigate((navigation) => {
    if ((dirty || unexported) && !navigation.willUnload && !discardWorkspace()) {
      navigation.cancel();
    }
  });
  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty || unexported) {
      event.preventDefault();
      event.returnValue = "";
    }
  }
  async function responseJson(response: Response) {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Unable to load or save lines");
    return result;
  }
  async function loadData() {
    if (!discardWorkspace()) return;
    loading = true;
    mode = data.mode;
    loadError = null;
    try {
      let nextLines: unknown;
      let nextStations: Station[];
      let nextGeometries: Map<string, LineGeometry>;
      if (data.mode === "local") {
        let geometryRecord: Record<string, unknown>;
        [nextLines, nextStations, geometryRecord] = await Promise.all([
          fetch("/api/lines").then(responseJson),
          fetch("/api/stations").then(responseJson),
          fetch("/api/line-geometry").then(responseJson),
        ]);
        nextGeometries = new Map(
          Object.entries(geometryRecord).flatMap(([id, geometry]) =>
            geometry ? [[id, validateLineGeometry(geometry, id)] as const] : [],
          ),
        );
      } else {
        const [lineData, stationData] = await Promise.all([
          import("@repo/data/lines"),
          import("@repo/data/stations"),
        ]);
        nextLines = lineData.lines;
        nextStations = stationData.stations;
        nextGeometries = await loadBundledGeometries(lineData.lines.map(({ id }) => id));
      }
      lines = validateLines(nextLines, new Set(nextStations.map((station) => station.id)));
      geometries = nextGeometries;
      stations = nextStations;
      mode = data.mode;
      draft = null;
      original = null;
      geometryEditing = false;
      routeIndex = 0;
      focusedStationId = null;
      fileName = data.mode === "local" ? "packages/data/src/lines.json" : "lines.json";
      saveError = null;
      unexported = false;
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Unable to load lines";
    } finally {
      loading = false;
    }
  }
  onMount(() => {
    void loadData();

    function onKeydown(event: KeyboardEvent) {
      const target = event.target;
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (
        target instanceof HTMLElement &&
        (target.matches("input, textarea, select") || target.isContentEditable)
      ) {
        return;
      }
      // Close the innermost layer first: the station card, then the editor.
      if (focusedStationId) focusedStationId = null;
      else if (draft) closeEditor();
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  function showAllLines() {
    if (draft) {
      closeEditor();
      // A cancelled discard prompt keeps the editor, and the current view, open.
      if (draft) return;
    }
    focusedStationId = null;
    search = "";
    typeFilter = "all";
    showUnlinked = false;
  }

  function selectLine(id: string) {
    if (saving || original?.id === id || !discardDraft()) return;
    const line = lines.find((line) => line.id === id);
    if (!line) return;
    original = line;
    editSession++;
    geometryEditing = false;
    draft = structuredClone(line);
    draftGeometry = geometries.get(line.id) ?? emptyGeometry();
    routeIndex = 0;
    focusedStationId = null;
    saveError = null;
  }
  function closeEditor() {
    if (saving || !discardDraft()) return;
    draft = null;
    original = null;
    geometryEditing = false;
    routeIndex = 0;
    saveError = null;
  }
  function addLine() {
    if (saving || !discardDraft()) return;
    original = null;
    geometryEditing = false;
    editSession++;
    draft = {
      id: "",
      name: "",
      code: null,
      type: "metro",
      color: null,
      operator: null,
      routes: [{ stations: [] }],
    };
    draftGeometry = emptyGeometry();
    routeIndex = 0;
    saveError = null;
    focusedStationId = null;
  }
  async function saveLine() {
    if (!draft || saving) return;
    saving = true;
    saveError = null;
    try {
      const next = validateLines([draft], stationIds)[0]!;
      const edited = validateLines(
        [...lines.filter((line) => line.id !== original?.id), next],
        stationIds,
      ).sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
      const geometry = validateLineGeometry(draftGeometry, next.id);
      if (mode === "local") {
        lines = await fetch(`/api/lines/${encodeURIComponent(original?.id ?? next.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            line: next,
            original,
            geometry,
            originalGeometry: original ? (geometries.get(original.id) ?? null) : null,
          }),
        }).then(responseJson);
      } else {
        lines = edited;
        unexported = true;
      }
      const nextGeometries = new Map(geometries);
      if (original) nextGeometries.delete(original.id);
      geometries = nextGeometries.set(next.id, geometry);
      original = lines.find((line) => line.id === next.id)!;
      draft = structuredClone(original);
      draftGeometry = geometry;
      showToast(
        mode === "local"
          ? "Line saved to lines.json"
          : "Line saved in browser · export lines.json to keep it",
      );
    } catch (error) {
      saveError = error instanceof Error ? error.message : "Unable to save line";
    } finally {
      saving = false;
    }
  }
  async function deleteLine() {
    if (!original || saving || !window.confirm(`Delete ${original.name} and all its routes?`))
      return;
    saving = true;
    saveError = null;
    try {
      if (mode === "local") {
        lines = await fetch(`/api/lines/${encodeURIComponent(original.id)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ original }),
        }).then(responseJson);
      } else {
        lines = lines.filter((line) => line.id !== original!.id);
        unexported = true;
      }
      const nextGeometries = new Map(geometries);
      nextGeometries.delete(original.id);
      geometries = nextGeometries;
      draft = null;
      original = null;
      geometryEditing = false;
      routeIndex = 0;
      showToast(
        mode === "local"
          ? "Line deleted from lines.json"
          : "Line deleted in browser · export lines.json to keep it",
      );
    } catch (error) {
      saveError = error instanceof Error ? error.message : "Unable to delete line";
    } finally {
      saving = false;
    }
  }
  async function importFile(file: File) {
    if (!discardWorkspace()) return;
    try {
      lines = validateLines(JSON.parse(await file.text()), stationIds);
      draft = null;
      original = null;
      geometryEditing = false;
      routeIndex = 0;
      focusedStationId = null;
      mode = "browser";
      unexported = false;
      fileName = file.name;
      showToast(`Imported ${file.name}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Invalid lines file");
    }
  }
  function exportFile() {
    if (dirty) {
      showToast("Save the selected line before exporting");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(lines) + "\n"], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "lines.json";
    link.click();
    URL.revokeObjectURL(url);
    unexported = false;
  }
</script>

<svelte:window onbeforeunload={beforeUnload} />
<svelte:head><title>Lines · Rail Studio</title></svelte:head>

<main class="flex h-screen flex-col overflow-hidden">
  <LineHeaderBar
    fileLabel={mode === "local" ? "Local file" : "Browser file"}
    {fileName}
    {dirty}
    {unexported}
    busy={loading || saving}
    isAddingLine={draft !== null && original === null}
    onReload={loadData}
    onHomeClick={showAllLines}
    onAddLineClick={addLine}
    onImportFile={importFile}
    onExportClick={exportFile}
  />

  {#if loading}
    <div class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      Loading lines and stations...
    </div>
  {:else if loadError}
    <div class="flex flex-1 items-center justify-center bg-background px-6">
      <div class="max-w-md border border-border bg-card p-6 text-sm shadow-xl">
        <h1 class="text-base font-semibold">Line data unavailable</h1>
        <p role="alert" class="mt-2 text-muted-foreground">{loadError}</p>
        <Button class="mt-4" onclick={loadData}>Retry</Button>
      </div>
    </div>
  {:else}
    <div class="flex min-h-0 flex-1">
      <LineSidebar
        {lines}
        {filteredLines}
        {unlinked}
        {filteredUnlinked}
        selectedLineId={original?.id ?? null}
        {focusedStationId}
        bind:search
        bind:typeFilter
        bind:showUnlinked
        onSelectLine={selectLine}
        onFocusStation={(id) => (focusedStationId = id)}
      />

      <div class="relative flex min-w-0 flex-1">
        <div class="min-w-0 flex-1">
          <LineMap
            lines={mapLines}
            geometries={mapGeometries}
            {stations}
            selectedLineId={draft?.id ?? null}
            selectionKey={editSession}
            selectedRouteIndex={draft ? routeIndex : null}
            {focusedStationId}
            onSelectLine={selectLine}
            onFocusStation={(id) => (focusedStationId = id)}
          />
        </div>

        {#if draft}
          {#key editSession}
            <LineEditPanel
              bind:draft
              bind:draftGeometry
              bind:routeIndex
              bind:geometryEditing
              geometryEditable={mode === "local"}
              {stations}
              {dirty}
              {saving}
              error={saveError}
              isNew={!original}
              onSave={saveLine}
              onDelete={deleteLine}
              onClose={closeEditor}
              onFocusStation={(id) => (focusedStationId = id)}
            />
          {/key}
        {/if}

        {#if focusedStation}
          {@const stationLines = index.getStationLines(focusedStation.id)}
          <div
            class="absolute left-3 top-3 z-10 w-72 max-w-[calc(100%-1.5rem)] border border-border bg-card/95 text-card-foreground shadow-xl backdrop-blur"
          >
            <div class="flex items-start justify-between gap-3 border-b border-border px-3 py-2.5">
              <div class="min-w-0">
                <div class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Station
                </div>
                <h3 class="mt-0.5 truncate text-sm font-semibold">{focusedStation.name}</h3>
                <p class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {focusedStation.id}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Close station details"
                onclick={() => (focusedStationId = null)}
              >
                <XIcon class="size-3" />
              </Button>
            </div>

            <div class="flex flex-col gap-1 px-1.5 py-1.5">
              <div
                class="px-1.5 pb-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                Lines · {stationLines.length}
              </div>
              {#each stationLines as line (line.id)}
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 w-full justify-start gap-2 px-1.5 text-left font-normal text-muted-foreground hover:text-foreground"
                  title={`${line.name}\n${line.operator ?? line.id}`}
                  onclick={() => selectLine(line.id)}
                >
                  <LineBadge {line} />
                  <span class="min-w-0 flex-1 truncate text-xs">{line.name}</span>
                </Button>
              {:else}
                <p class="px-1.5 pb-1 text-xs text-muted-foreground">No saved line assigned</p>
              {/each}
            </div>

            {#if draft && selectedRoute}
              <div class="border-t border-border p-2">
                <Button
                  class="w-full"
                  size="sm"
                  variant="outline"
                  disabled={saving || focusedIsLastStop}
                  onclick={() => selectedRoute.stations.push(focusedStation.id)}
                >
                  {#if focusedIsLastStop}
                    <CheckIcon class="size-3.5" />
                    Last stop of route {selectedRoute.code ?? routeIndex + 1}
                  {:else}
                    <PlusIcon class="size-3.5" />
                    {focusedOnRoute ? "Add again to route" : "Add to route"}
                    {selectedRoute.code ?? routeIndex + 1}
                  {/if}
                </Button>
              </div>
            {/if}
          </div>
        {/if}

        {#if toastMessage}
          <div
            class="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-none border border-border bg-card px-4 py-2 text-sm shadow-xl"
            role="status"
          >
            {toastMessage}
          </div>
        {/if}
      </div>
    </div>

    <LineStatusBar
      {lines}
      unlinkedCount={unlinked.length}
      {fileName}
      {selectedRoute}
      selectedRouteNumber={routeIndex + 1}
      {stateLabel}
    />
  {/if}
</main>
