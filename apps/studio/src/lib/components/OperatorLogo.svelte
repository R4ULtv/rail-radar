<script lang="ts">
  import { Building2Icon } from "@lucide/svelte";
  import { cn } from "$lib/utils";

  let {
    path,
    local = false,
    class: className,
  }: { path: string; local?: boolean; class?: string } = $props();
  let failedSrc = $state<string | null>(null);
  const src = $derived(
    /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/.test(path)
      ? `${local ? "/api/operator-logos" : "https://railradar24.com/assets/operators"}/${path}.svg`
      : null,
  );
</script>

<span
  class={cn(
    "flex size-9 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted",
    className,
  )}
>
  {#if src && failedSrc !== src}
    <img
      {src}
      alt=""
      class="size-full object-contain"
      loading="lazy"
      decoding="async"
      onerror={(event) => (failedSrc = event.currentTarget.getAttribute("src"))}
    />
  {:else}
    <Building2Icon class="size-4 text-muted-foreground" />
  {/if}
</span>
