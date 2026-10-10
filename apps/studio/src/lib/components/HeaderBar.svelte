<script lang="ts">
  import {
    DownloadIcon,
    GitPullRequestIcon,
    MapPinIcon,
    PlusIcon,
    Redo2Icon,
    Undo2Icon,
    UploadIcon,
  } from "@lucide/svelte";
  import AppHeader from "$lib/components/AppHeader.svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import StationFileFormatIcon from "$lib/components/StationFileFormatIcon.svelte";
  import type { StationFileFormat } from "$lib/stations";

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
    onExportClick: (format: StationFileFormat) => void;
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

<AppHeader fileLabel={mode === "local" ? "Local file" : "Browser file"} {fileName} {onHomeClick}>
  {#snippet tools()}
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
  {/snippet}

  {#snippet actions()}
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
      accept=".geojson,.json,.csv,application/geo+json,application/json,text/csv"
      class="hidden"
      onchange={handleFileChange}
    />

    <Button variant="outline" size="sm" onclick={() => fileInput?.click()}>
      <UploadIcon class="size-3.5" />
      <span class="hidden sm:inline">Import</span>
    </Button>

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button variant="outline" size="sm" disabled={!canExport} {...props}>
            <DownloadIcon class="size-3.5" />
            <span class="hidden sm:inline">Export</span>
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="min-w-40">
        <DropdownMenu.Item onclick={() => onExportClick("geojson")}>
          <StationFileFormatIcon format="geojson" class="text-muted-foreground" />
          <span>GeoJSON</span>
        </DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => onExportClick("json")}>
          <StationFileFormatIcon format="json" class="text-muted-foreground" />
          <span>JSON</span>
        </DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => onExportClick("csv")}>
          <StationFileFormatIcon format="csv" class="text-muted-foreground" />
          <span>CSV</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/snippet}
</AppHeader>
