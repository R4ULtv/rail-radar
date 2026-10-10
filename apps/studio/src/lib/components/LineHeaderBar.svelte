<script lang="ts">
  import { DownloadIcon, PlusIcon, RefreshCwIcon, UploadIcon } from "@lucide/svelte";
  import AppHeader from "$lib/components/AppHeader.svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";

  let {
    fileLabel,
    fileName,
    dirty,
    unexported,
    busy,
    isAddingLine,
    onReload,
    onHomeClick,
    onAddLineClick,
    onImportFile,
    onExportClick,
  }: {
    fileLabel: string;
    fileName: string | null;
    dirty: boolean;
    /** Browser-mode saves that exist only in memory until exported. */
    unexported: boolean;
    busy: boolean;
    isAddingLine: boolean;
    onReload: () => void;
    onHomeClick: () => void;
    onAddLineClick: () => void;
    onImportFile: (file: File) => void;
    onExportClick: () => void;
  } = $props();

  let fileInput: HTMLInputElement | null = null;

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (file) onImportFile(file);
  }
</script>

<AppHeader {fileLabel} {fileName} homeTitle="Back to all lines" {onHomeClick}>
  {#snippet tools()}
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={busy}
      onclick={onReload}
      title="Reload lines"
      aria-label="Reload lines"
    >
      <RefreshCwIcon class="size-3.5" />
    </Button>

    {#if dirty}
      <Badge
        class="ml-1 border-accent bg-accent font-mono text-[10px] text-accent-foreground hover:bg-accent"
      >
        Unsaved
      </Badge>
    {/if}
    {#if unexported}
      <Badge
        variant="outline"
        class="ml-1 font-mono text-[10px]"
        title="Saved in this browser only. Export lines.json to keep these changes."
      >
        Not exported
      </Badge>
    {/if}
  {/snippet}

  {#snippet actions()}
    <Button
      variant={isAddingLine ? "default" : "outline"}
      size="sm"
      disabled={busy}
      onclick={onAddLineClick}
      title="Add line"
      aria-label="Add line"
    >
      <PlusIcon class="size-3.5" />
      <span class="hidden sm:inline">Add Line</span>
    </Button>

    <div class="h-6 w-px shrink-0 bg-border" aria-hidden="true"></div>

    <input
      bind:this={fileInput}
      type="file"
      accept=".json,application/json"
      class="hidden"
      onchange={handleFileChange}
    />

    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onclick={() => fileInput?.click()}
      aria-label="Import lines"
    >
      <UploadIcon class="size-3.5" />
      <span class="hidden sm:inline">Import</span>
    </Button>

    <Button
      variant="outline"
      size="sm"
      disabled={busy || dirty}
      onclick={onExportClick}
      title={dirty ? "Save the selected line before exporting" : "Export lines.json"}
      aria-label="Export lines"
    >
      <DownloadIcon class="size-3.5" />
      <span class="hidden sm:inline">Export</span>
    </Button>
  {/snippet}
</AppHeader>
