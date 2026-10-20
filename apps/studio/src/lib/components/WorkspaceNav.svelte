<script lang="ts">
  import { MapPinIcon, RouteIcon } from "@lucide/svelte";
  import { page } from "$app/state";
  import { cn } from "$lib/utils";

  let { class: className }: { class?: string } = $props();

  const workspaces = [
    { href: "/", label: "Stations", icon: MapPinIcon },
    { href: "/lines", label: "Lines", icon: RouteIcon },
  ];
  const pathname = $derived(page.url.pathname.replace(/\/$/, "") || "/");
</script>

<nav
  class={cn("inline-flex h-8 shrink-0 items-center bg-muted p-[3px]", className)}
  aria-label="Workspace"
>
  {#each workspaces as workspace (workspace.href)}
    {@const active = pathname === workspace.href}
    <a
      href={workspace.href}
      aria-current={active ? "page" : undefined}
      class={cn(
        "inline-flex h-full items-center gap-1.5 border border-transparent px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:border-ring focus-visible:outline-none",
        active && "border-input bg-input/30 text-foreground",
      )}
    >
      <workspace.icon class="size-3.5" />
      {workspace.label}
    </a>
  {/each}
</nav>
