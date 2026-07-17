<script lang="ts">
  import {
    DownloadIcon,
    FileUpIcon,
    GitPullRequestIcon,
    MapPinIcon,
    PlusIcon,
    Redo2Icon,
    Undo2Icon,
    UploadIcon,
  } from "@lucide/svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";

  let {
    fileName,
    mode,
    modifiedCount,
    isAddingStation,
    canExport,
    onImportFile,
    onExportClick,
    onAddStationClick,
    onReviewClick,
    onHomeClick,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    onUndo,
    onRedo,
  }: {
    fileName: string | null;
    mode: "local" | "browser";
    modifiedCount: number;
    isAddingStation: boolean;
    canExport: boolean;
    onImportFile: (file: File) => void;
    onExportClick: () => void;
    onAddStationClick: () => void;
    onReviewClick: () => void;
    onHomeClick: () => void;
    canUndo: boolean;
    canRedo: boolean;
    undoLabel: string | null;
    redoLabel: string | null;
    onUndo: () => void;
    onRedo: () => void;
  } = $props();

  let fileInput: HTMLInputElement | null = null;

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) onImportFile(file);
    input.value = "";
  }
</script>

<header
  class="flex h-13 shrink-0 items-center gap-3 border-b border-border bg-card/90 px-3 text-card-foreground backdrop-blur"
>
  <button
    type="button"
    class="flex items-center gap-2.5 pr-1 text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    onclick={onHomeClick}
    title="Back to start"
  >
    <img src="/icon.svg" alt="" class="size-7 shrink-0" />
    <div class="leading-tight">
      <div class="text-[13px] font-semibold">Rail Studio</div>
      <div class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Station Manager
      </div>
    </div>
  </button>

  <Separator orientation="vertical" class="hidden h-6 sm:block" />

  <div class="hidden min-w-0 items-center gap-2 md:flex">
    <FileUpIcon class="size-3.5 shrink-0 text-muted-foreground" />
    <div class="min-w-0 leading-tight">
      <div class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {mode === "local" ? "Local file" : "Browser file"}
      </div>
      <div class="max-w-[18rem] truncate text-xs font-medium">
        {fileName ?? "No file loaded"}
      </div>
    </div>
  </div>

  <Separator orientation="vertical" class="hidden h-6 md:block" />

  <div class="hidden items-center gap-1 md:flex">
    <Button
      variant="ghost"
      size="icon-sm"
      onclick={onUndo}
      disabled={!canUndo}
      title={canUndo ? `Undo ${undoLabel ?? ""}` : "Nothing to undo"}
    >
      <Undo2Icon class="size-3.5" />
    </Button>

    <Button
      variant="ghost"
      size="icon-sm"
      onclick={onRedo}
      disabled={!canRedo}
      title={canRedo ? `Redo ${redoLabel ?? ""}` : "Nothing to redo"}
    >
      <Redo2Icon class="size-3.5" />
    </Button>

    {#if modifiedCount > 0}
      <Badge
        class="ml-1 border-accent bg-accent font-mono text-[10px] text-accent-foreground hover:bg-accent"
      >
        {modifiedCount} changed
      </Badge>
    {/if}
  </div>

  <div class="ml-auto flex min-w-0 items-center gap-2">
    <Button
      variant={isAddingStation ? "default" : "outline"}
      size="sm"
      onclick={onAddStationClick}
      title={isAddingStation ? "Cancel add station" : "Add station"}
    >
      {#if isAddingStation}
        <MapPinIcon class="size-3.5" />
        <span class="hidden sm:inline">Drop pin</span>
      {:else}
        <PlusIcon class="size-3.5" />
        <span class="hidden sm:inline">Add Station</span>
      {/if}
    </Button>

    <Button variant="outline" size="sm" onclick={onReviewClick}>
      <GitPullRequestIcon class="size-3.5" />
      <span class="hidden sm:inline">Review</span>
      {#if modifiedCount > 0}
        <span class="font-mono text-[10px] text-muted-foreground">{modifiedCount}</span>
      {/if}
    </Button>

    <div class="h-6 w-px shrink-0 bg-border" aria-hidden="true"></div>

    <input
      bind:this={fileInput}
      type="file"
      accept=".geojson,.json,application/geo+json,application/json"
      class="hidden"
      onchange={handleFileChange}
    />

    <Button variant="outline" size="sm" onclick={() => fileInput?.click()}>
      <UploadIcon class="size-3.5" />
      <span class="hidden sm:inline">Import</span>
    </Button>

    <Button variant="outline" size="sm" disabled={!canExport} onclick={onExportClick}>
      <DownloadIcon class="size-3.5" />
      <span class="hidden sm:inline">Export</span>
    </Button>
  </div>
</header>
