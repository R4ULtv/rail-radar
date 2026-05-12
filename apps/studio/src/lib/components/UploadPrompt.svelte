<script lang="ts">
  import { CloudDownloadIcon } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { remoteStationSources, type RemoteStationSourceId } from "$lib/stores/stations";

  let {
    error = null,
    onImportFile,
    onLoadRemoteSource,
  }: {
    error: string | null;
    onImportFile: (file: File) => void | Promise<void>;
    onLoadRemoteSource: (sourceId: RemoteStationSourceId) => void | Promise<void>;
  } = $props();

  async function handleFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await onImportFile(file);
    input.value = "";
  }
</script>

<main class="flex min-h-screen items-center justify-center p-6 text-primary">
  <Card.Root class="w-full max-w-xl shadow-2xl">
    <Card.Header>
      <p class="text-sm font-medium text-accent">Rail Radar Studio Beta</p>
      <Card.Title class="text-2xl">Open a station GeoJSON file</Card.Title>
      <Card.Description class="leading-6">
        The local project version loads the repository data automatically. In deployed browser mode,
        start from the latest repository data or upload a station `.geojson`, edit it here, then
        export the updated file.
      </Card.Description>
    </Card.Header>

    <Card.Content class="space-y-5">
      <section>
        <div class="mb-2 text-xs font-medium uppercase text-muted-foreground">
          Latest repository version
        </div>
        <div class="grid gap-2 sm:grid-cols-2">
          {#each remoteStationSources as source}
            <Button
              variant="outline"
              class="h-auto items-start justify-start gap-3 whitespace-normal p-3 text-left"
              onclick={() => onLoadRemoteSource(source.id)}
            >
              <CloudDownloadIcon class="size-4 shrink-0 text-accent" />
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium">{source.label}</span>
                <span class="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {source.description}
                </span>
              </span>
            </Button>
          {/each}
        </div>
      </section>

      <div class="flex items-center gap-3 text-xs uppercase text-muted-foreground">
        <div class="h-px flex-1 bg-border"></div>
        <span>or</span>
        <div class="h-px flex-1 bg-border"></div>
      </div>

      <label
        class="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center transition hover:border-primary"
      >
        <span class="text-base font-medium">Choose `.geojson` file</span>
        <span class="mt-1 text-sm text-muted-foreground"
          >FeatureCollection with station point features</span
        >
        <input
          class="sr-only"
          type="file"
          accept=".geojson,application/geo+json,application/json"
          onchange={handleFile}
        />
      </label>

      {#if error}
        <p
          class="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      {/if}
    </Card.Content>

    <Card.Footer>
      <Button
        variant="outline"
        class="w-full"
        onclick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
      >
        Select File
      </Button>
    </Card.Footer>
  </Card.Root>
</main>
