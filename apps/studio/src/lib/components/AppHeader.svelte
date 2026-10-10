<script lang="ts">
  import { FileUpIcon } from "@lucide/svelte";
  import type { Snippet } from "svelte";
  import { Separator } from "$lib/components/ui/separator";
  import WorkspaceNav from "$lib/components/WorkspaceNav.svelte";

  let {
    fileLabel,
    fileName,
    homeTitle = "Back to start",
    onHomeClick,
    tools,
    actions,
  }: {
    fileLabel: string;
    fileName: string | null;
    homeTitle?: string;
    onHomeClick: () => void;
    tools?: Snippet;
    actions: Snippet;
  } = $props();
</script>

<header
  class="flex h-13 shrink-0 items-center gap-3 border-b border-border bg-card/90 px-3 text-card-foreground backdrop-blur"
>
  <button
    type="button"
    class="flex shrink-0 items-center gap-2.5 pr-1 text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    onclick={onHomeClick}
    title={homeTitle}
  >
    <img src="/icon.svg" alt="" class="size-7 shrink-0" />
    <div class="hidden leading-tight xl:block">
      <div class="text-[13px] font-semibold">Rail Studio</div>
      <div class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Dataset editor
      </div>
    </div>
  </button>

  <WorkspaceNav />

  <Separator orientation="vertical" class="hidden h-6 lg:block" />

  <div class="hidden min-w-0 items-center gap-2 lg:flex">
    <FileUpIcon class="size-3.5 shrink-0 text-muted-foreground" />
    <div class="min-w-0 leading-tight">
      <div class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {fileLabel}
      </div>
      <div class="max-w-[18rem] truncate text-xs font-medium" title={fileName ?? undefined}>
        {fileName ?? "No file loaded"}
      </div>
    </div>
  </div>

  {#if tools}
    <Separator orientation="vertical" class="hidden h-6 md:block" />
    <div class="hidden items-center gap-1 md:flex">
      {@render tools()}
    </div>
  {/if}

  <div class="ml-auto flex shrink-0 items-center gap-2">
    {@render actions()}
  </div>
</header>
