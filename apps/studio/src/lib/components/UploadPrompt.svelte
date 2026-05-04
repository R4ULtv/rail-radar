<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card";
    import { stationStore } from "$lib/stores/stations";

    let { error = null }: { error: string | null } = $props();

    async function handleFile(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (file) await stationStore.loadUploadedFile(file);
    }
</script>

<main class="flex min-h-screen items-center justify-center p-6 text-primary">
    <Card.Root class="w-full max-w-xl shadow-2xl">
        <Card.Header>
            <p class="text-sm font-medium text-blue-300">
                Rail Radar Studio Beta
            </p>
            <Card.Title class="text-2xl">Open a station GeoJSON file</Card.Title
            >
            <Card.Description class="leading-6">
                The local project version loads the repository data
                automatically. In deployed browser mode, upload a station
                `.geojson`, edit it here, then export the updated file.
            </Card.Description>
        </Card.Header>

        <Card.Content>
            <label
                class="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center transition hover:border-primary"
            >
                <span class="text-base font-medium">Choose `.geojson` file</span
                >
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
                onclick={() =>
                    document
                        .querySelector<HTMLInputElement>('input[type="file"]')
                        ?.click()}
            >
                Select File
            </Button>
        </Card.Footer>
    </Card.Root>
</main>
