<script lang="ts">
  import { CheckIcon, CopyIcon, ExternalLinkIcon, MapPinIcon } from "@lucide/svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Separator } from "$lib/components/ui/separator";
  import { generatePRBody, generatePRTitle } from "$lib/pr-generator";
  import { contributionStore } from "$lib/stores/contribution";
  import type { StationChange } from "$lib/types/contribution";

  let {
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  } = $props();

  let copied = $state<"title" | "body" | null>(null);

  const changesStore = contributionStore.changes;
  const statsStore = contributionStore.stats;
  const isSessionActiveStore = contributionStore.isSessionActive;
  const changes = $derived($changesStore);
  const stats = $derived($statsStore);
  const isSessionActive = $derived($isSessionActiveStore);
  const title = $derived(stats ? generatePRTitle(stats) : "");
  const body = $derived(stats ? generatePRBody(changes, stats) : "");

  function formatChangeDetails(change: StationChange): string {
    if (change.type === "created") {
      return change.details.newGeo
        ? `Created at (${change.details.newGeo.lat.toFixed(4)}, ${change.details.newGeo.lng.toFixed(4)})`
        : "Created";
    }
    if (change.type === "deleted") return "Deleted";

    const updates: string[] = [];
    if (change.details.coordinatesUpdated && change.details.newGeo) {
      updates.push(
        `Moved to (${change.details.newGeo.lat.toFixed(4)}, ${change.details.newGeo.lng.toFixed(4)})`,
      );
    }
    if (change.details.nameChanged) updates.push(`Renamed from "${change.details.previousName}"`);
    if (change.details.typeChanged) updates.push(`Type changed to ${change.details.newType}`);
    if (change.details.importanceChanged) {
      updates.push(`Importance changed to ${change.details.newImportance}`);
    }
    return updates.join(", ") || "Updated";
  }

  async function copyText(kind: "title" | "body", value: string) {
    await navigator.clipboard.writeText(value);
    copied = kind;
    window.setTimeout(() => {
      if (copied === kind) copied = null;
    }, 1600);
  }

  function openGitHub() {
    const params = new URLSearchParams({ quick_pull: "1", title, body });
    window.open(`https://github.com/r4ultv/rail-radar/compare/main...HEAD?${params.toString()}`, "_blank");
  }

  function clearSession() {
    contributionStore.clearSession();
    onOpenChange(false);
  }
</script>

<Dialog.Root {open} onOpenChange={onOpenChange}>
  <Dialog.Content class="flex max-h-[85vh] flex-col sm:max-w-xl">
    <Dialog.Header>
      <Dialog.Title>Contribution Session</Dialog.Title>
      <Dialog.Description>Review your changes</Dialog.Description>
    </Dialog.Header>

    <div class="min-h-0 flex-1 space-y-4 overflow-hidden">
      {#if stats}
        <div class="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div class="text-muted-foreground">Changes</div>
            <div class="text-2xl font-semibold">{stats.changesCount}</div>
          </div>
          <div>
            <div class="text-muted-foreground">Coords Moved</div>
            <div class="text-2xl font-semibold">{stats.coordinatesUpdated}</div>
          </div>
          <div>
            <div class="text-muted-foreground">Renamed</div>
            <div class="text-2xl font-semibold">{stats.stationsRenamed}</div>
          </div>
        </div>
        <Separator />
      {/if}

      <ScrollArea class="max-h-48">
        {#if changes.length === 0}
          <div class="py-8 text-center text-sm text-muted-foreground">
            <MapPinIcon class="mx-auto mb-2 size-8 opacity-50" />
            <p>No changes yet</p>
            <p class="mt-1">Start editing stations to track your contributions.</p>
          </div>
        {:else}
          <div class="space-y-2 pr-4">
            {#each changes as change (change.id)}
              <div class="rounded-md border border-border bg-muted/30 p-3">
                <div class="flex items-center gap-2">
                  <Badge variant={change.type === "deleted" ? "destructive" : "secondary"}>{change.type}</Badge>
                  <div class="min-w-0 truncate font-medium">{change.stationName}</div>
                </div>
                <div class="mt-1 text-xs text-muted-foreground">{formatChangeDetails(change)}</div>
              </div>
            {/each}
          </div>
        {/if}
      </ScrollArea>

      {#if isSessionActive}
        <Separator />

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="pr-title">PR Title</Label>
            <Button variant="ghost" size="sm" onclick={() => copyText("title", title)}>
              {#if copied === "title"}<CheckIcon class="size-3" /> Copied{:else}<CopyIcon class="size-3" /> Copy{/if}
            </Button>
          </div>
          <Input id="pr-title" value={title} readonly class="font-mono text-sm" />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="pr-body">PR Description</Label>
            <Button variant="ghost" size="sm" onclick={() => copyText("body", body)}>
              {#if copied === "body"}<CheckIcon class="size-3" /> Copied{:else}<CopyIcon class="size-3" /> Copy{/if}
            </Button>
          </div>
          <ScrollArea class="h-48 rounded-md border border-border bg-muted/30">
            <pre id="pr-body" class="whitespace-pre-wrap p-3 font-mono text-xs">{body}</pre>
          </ScrollArea>
        </div>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={clearSession}>Clear Session</Button>
      <Button disabled={!isSessionActive} onclick={openGitHub}>
        <ExternalLinkIcon class="size-4" />
        Open in GitHub
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
