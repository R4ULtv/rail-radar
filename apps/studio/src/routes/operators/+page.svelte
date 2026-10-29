<script lang="ts">
  import type { Line, Operator } from "@repo/data";
  import { Building2Icon, PlusIcon } from "@lucide/svelte";
  import { beforeNavigate } from "$app/navigation";
  import { onMount } from "svelte";
  import OperatorEditPanel from "$lib/components/OperatorEditPanel.svelte";
  import OperatorHeaderBar from "$lib/components/OperatorHeaderBar.svelte";
  import OperatorSidebar from "$lib/components/OperatorSidebar.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Alert from "$lib/components/ui/alert";
  import * as Empty from "$lib/components/ui/empty";
  import {
    createOperator,
    getOperatorInUseError,
    operatorMatchesFilters,
    replaceOperator,
    validateOperators,
    type OperatorCountryFilter,
    type OperatorTypeFilter,
  } from "$lib/operators";
  import type { DataMode } from "$lib/stores/stations";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  let operators = $state.raw<Operator[]>([]);
  let lines = $state.raw<Line[]>([]);
  let mode = $state<DataMode>("browser");
  let loading = $state(true);
  let saving = $state(false);
  let loadError = $state<string | null>(null);
  let saveError = $state<string | null>(null);
  let fileName = $state<string | null>(null);
  let original = $state.raw<Operator | null>(null);
  let draft = $state<Operator | null>(null);
  let editSession = $state(0);
  let unexported = $state(false);
  let toastMessage = $state<string | null>(null);
  let search = $state("");
  let typeFilter = $state<OperatorTypeFilter>("all");
  let countryFilter = $state<OperatorCountryFilter>("all");

  const dirty = $derived(draft !== null && JSON.stringify(draft) !== JSON.stringify(original));
  const busy = $derived(loading || saving);
  const filteredOperators = $derived(
    operators
      .filter((operator) => operatorMatchesFilters(operator, search, typeFilter, countryFilter))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  const freightCount = $derived(
    operators.filter((operator) => operator.operatorTypes.includes("freight")).length,
  );

  function showToast(message: string) {
    toastMessage = message;
    window.setTimeout(() => {
      if (toastMessage === message) toastMessage = null;
    }, 3000);
  }

  function discardDraft(): boolean {
    return !dirty || window.confirm("Discard unsaved operator changes?");
  }

  function discardWorkspace(): boolean {
    return unexported
      ? window.confirm(
          "Operators saved in this browser haven't been exported. Discard them and any unsaved changes?",
        )
      : discardDraft();
  }

  beforeNavigate((navigation) => {
    if (saving || (!navigation.willUnload && (dirty || unexported) && !discardWorkspace()))
      navigation.cancel();
  });

  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty || unexported || saving) {
      event.preventDefault();
      event.returnValue = "";
    }
  }

  async function responseJson(response: Response) {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Unable to load or save operators");
    return body;
  }

  async function loadData() {
    if (saving || !discardWorkspace()) return;
    loading = true;
    loadError = null;
    try {
      let nextOperators: unknown;
      let nextLines: Line[];
      if (data.mode === "local") {
        [nextOperators, nextLines] = await Promise.all([
          fetch("/api/operators").then(responseJson),
          fetch("/api/lines").then(responseJson),
        ]);
      } else {
        const [operatorData, lineData] = await Promise.all([
          import("@repo/data/operators"),
          import("@repo/data/lines"),
        ]);
        nextOperators = operatorData.operators;
        nextLines = lineData.lines;
      }
      operators = validateOperators(nextOperators);
      lines = nextLines;
      mode = data.mode;
      original = null;
      draft = null;
      saveError = null;
      unexported = false;
      fileName = mode === "local" ? "packages/data/src/operators.json" : "operators.json";
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Unable to load operators";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadData();
    const shortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (draft && dirty && !busy) void saveOperator();
      } else if (event.key === "Escape" && !inField && !busy) closeEditor();
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });

  function selectOperator(operator: Operator) {
    if (busy || original?.slug === operator.slug || !discardDraft()) return;
    original = operator;
    draft = structuredClone(operator);
    saveError = null;
    editSession += 1;
  }

  function closeEditor() {
    if (busy || !discardDraft()) return;
    original = null;
    draft = null;
    saveError = null;
  }

  function addOperator() {
    if (busy || !discardDraft()) return;
    original = null;
    draft = createOperator(typeFilter === "all" ? "passenger" : typeFilter);
    if (countryFilter !== "all") draft.countries = [countryFilter];
    saveError = null;
    editSession += 1;
  }

  async function saveOperator() {
    if (!draft || busy) return;
    saveError = null;
    try {
      const candidate = validateOperators([draft])[0]!;
      if (original && candidate.slug !== original.slug) {
        const error = getOperatorInUseError(lines, original.slug);
        if (error) throw new Error(error);
      }
      const slug = original?.slug ?? candidate.slug;
      // Validate duplicates before either local or browser persistence.
      const updated = replaceOperator(operators, original?.slug ?? "", candidate);
      saving = true;
      if (mode === "local") {
        operators = validateOperators(
          await fetch(`/api/operators/${encodeURIComponent(slug)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operator: candidate, original }),
          }).then(responseJson),
        );
      } else {
        operators = updated;
        unexported = true;
      }
      original = operators.find((operator) => operator.slug === candidate.slug)!;
      draft = structuredClone(original);
      showToast(
        mode === "local"
          ? "Operator saved to operators.json"
          : "Operator saved in browser · export operators.json to keep it",
      );
    } catch (error) {
      saveError = error instanceof Error ? error.message : "Unable to save operator";
    } finally {
      saving = false;
    }
  }

  async function deleteOperator() {
    if (!original || busy) return;
    const error = getOperatorInUseError(lines, original.slug);
    if (error) {
      saveError = error;
      return;
    }
    if (
      !window.confirm(
        `Delete ${original.name}?${dirty ? " Unsaved changes to this profile will also be discarded." : ""}`,
      )
    )
      return;
    saving = true;
    saveError = null;
    try {
      if (mode === "local") {
        operators = validateOperators(
          await fetch(`/api/operators/${encodeURIComponent(original.slug)}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ original }),
          }).then(responseJson),
        );
      } else {
        operators = operators.filter((operator) => operator.slug !== original!.slug);
        unexported = true;
      }
      original = null;
      draft = null;
      showToast(
        mode === "local"
          ? "Operator deleted from operators.json"
          : "Operator deleted in browser · export operators.json to keep it",
      );
    } catch (error) {
      saveError = error instanceof Error ? error.message : "Unable to delete operator";
    } finally {
      saving = false;
    }
  }

  async function importFile(file: File) {
    if (busy || !discardWorkspace()) return;
    loading = true;
    loadError = null;
    try {
      const imported = validateOperators(JSON.parse(await file.text()));
      const { lines: bundledLines } = await import("@repo/data/lines");
      operators = imported;
      lines = bundledLines;
      original = null;
      draft = null;
      saveError = null;
      mode = "browser";
      fileName = file.name;
      unexported = false;
      showToast(`Imported ${file.name}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Invalid operators file");
    } finally {
      loading = false;
    }
  }

  function exportFile() {
    if (busy || dirty) return;
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(operators, null, 2)}\n`], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "operators.json";
    link.click();
    URL.revokeObjectURL(url);
    unexported = false;
    showToast("Exported operators.json");
  }
</script>

<svelte:window onbeforeunload={beforeUnload} />
<svelte:head><title>Operators · Rail Studio</title></svelte:head>

<main class="flex h-screen flex-col overflow-hidden">
  <OperatorHeaderBar
    {fileName}
    local={mode === "local"}
    {dirty}
    {unexported}
    {busy}
    onReload={loadData}
    onHome={closeEditor}
    onCreate={addOperator}
    onImport={importFile}
    onExport={exportFile}
  />
  {#if loading}
    <div
      class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
      role="status"
    >
      Loading operators...
    </div>
  {:else if loadError}
    <div class="m-auto w-full max-w-xl p-6">
      <Alert.Root variant="destructive"
        ><Alert.Title>Operators unavailable</Alert.Title><Alert.Description
          >{loadError}</Alert.Description
        ></Alert.Root
      >
      <Button variant="outline" class="mt-4" onclick={loadData}>Reload operators</Button>
    </div>
  {:else}
    <div class="relative flex min-h-0 flex-1">
      <OperatorSidebar
        operators={filteredOperators}
        total={operators.length}
        selectedSlug={original?.slug ?? null}
        editorOpen={draft !== null}
        local={mode === "local"}
        {busy}
        bind:search
        bind:typeFilter
        bind:countryFilter
        onSelect={selectOperator}
      />
      {#if draft}
        {#key editSession}<OperatorEditPanel
            bind:draft
            {original}
            {lines}
            local={mode === "local"}
            {busy}
            {dirty}
            error={saveError}
            onSave={saveOperator}
            onDelete={deleteOperator}
            onClose={closeEditor}
          />{/key}
      {:else}
        <div class="flex min-w-0 flex-1 items-center justify-center max-md:hidden">
          <Empty.Root
            ><Empty.Header
              ><Empty.Media variant="icon"><Building2Icon /></Empty.Media><Empty.Title
                >Operator profiles</Empty.Title
              ><Empty.Description
                >Select an operator to edit its profile, countries and services, or create a new
                passenger or freight operator.</Empty.Description
              ></Empty.Header
            ><Empty.Content
              ><Button variant="outline" onclick={addOperator}
                ><PlusIcon data-icon="inline-start" />Add operator</Button
              ></Empty.Content
            ></Empty.Root
          >
        </div>
      {/if}
      {#if toastMessage}<div
          class="pointer-events-none absolute bottom-4 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 border border-border bg-card px-4 py-2 text-sm text-card-foreground shadow-xl"
          role="status"
        >
          {toastMessage}
        </div>{/if}
    </div>
    <footer
      class="flex h-7 shrink-0 items-center gap-4 overflow-hidden border-t border-border bg-card px-3 font-mono text-[11px] text-muted-foreground"
    >
      <span>{operators.length} operators</span><span class="hidden sm:inline"
        >{freightCount} freight</span
      ><span class="ml-auto truncate"
        >{saving
          ? "Saving..."
          : dirty
            ? "Unsaved changes"
            : unexported
              ? "Saved in browser · not exported"
              : mode === "local"
                ? "Local file"
                : "Browser file"}</span
      >
    </footer>
  {/if}
</main>
