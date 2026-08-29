<script lang="ts">
  import { FileBracesIcon, FileSpreadsheetIcon, GlobeIcon } from "@lucide/svelte";
  import type { StationFileFormat } from "$lib/stations";
  import { cn } from "$lib/utils";

  let {
    format,
    class: className,
  }: {
    format: StationFileFormat;
    class?: string;
  } = $props();
</script>

{#if format === "json"}
  <FileBracesIcon aria-hidden="true" class={cn("size-4", className)} />
{:else if format === "csv"}
  <FileSpreadsheetIcon aria-hidden="true" class={cn("size-4", className)} />
{:else}
  <GlobeIcon aria-hidden="true" class={cn("size-4", className)} />
{/if}
