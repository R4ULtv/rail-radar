<script lang="ts">
  import { DownloadIcon, PlusIcon, RefreshCwIcon, UploadIcon } from "@lucide/svelte";
  import AppHeader from "$lib/components/AppHeader.svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";

  let {
    fileName,
    local,
    dirty,
    unexported,
    busy,
    onReload,
    onHome,
    onCreate,
    onImport,
    onExport,
  }: {
    fileName: string | null;
    local: boolean;
    dirty: boolean;
    unexported: boolean;
    busy: boolean;
    onReload: () => void;
    onHome: () => void;
    onCreate: () => void;
    onImport: (file: File) => void;
    onExport: () => void;
  } = $props();
  let fileInput: HTMLInputElement | null = null;
</script>

<AppHeader
  {fileName}
  fileLabel={local ? "Local file" : "Browser file"}
  homeTitle="Back to all operators"
  onHomeClick={onHome}
>
  {#snippet tools()}
    {#if dirty}<Badge variant="secondary">Unsaved</Badge>{/if}
    {#if unexported}<Badge
        variant="outline"
        title="Export operators.json to keep changes saved in this browser.">Not exported</Badge
      >{/if}
  {/snippet}
  {#snippet actions()}
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={busy}
      onclick={onReload}
      title="Reload operators"
      aria-label="Reload operators"><RefreshCwIcon /></Button
    >
    <Button
      variant="outline"
      size="sm"
      class="max-sm:size-7 max-sm:p-0"
      disabled={busy}
      onclick={onCreate}
      aria-label="Add operator"
      ><PlusIcon data-icon="inline-start" /><span class="hidden sm:inline">Add operator</span
      ></Button
    >
    <input
      bind:this={fileInput}
      type="file"
      accept=".json,application/json"
      class="hidden"
      onchange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) onImport(file);
      }}
    />
    <Button
      variant="outline"
      size="sm"
      class="max-sm:size-7 max-sm:p-0"
      disabled={busy}
      onclick={() => fileInput?.click()}
      aria-label="Import operators"
      ><UploadIcon data-icon="inline-start" /><span class="hidden sm:inline">Import</span></Button
    >
    <Button
      variant="outline"
      size="sm"
      class="max-sm:size-7 max-sm:p-0"
      disabled={busy || dirty}
      onclick={onExport}
      title={dirty ? "Save the selected operator before exporting" : "Export operators.json"}
      aria-label="Export operators"
      ><DownloadIcon data-icon="inline-start" /><span class="hidden sm:inline">Export</span></Button
    >
  {/snippet}
</AppHeader>
