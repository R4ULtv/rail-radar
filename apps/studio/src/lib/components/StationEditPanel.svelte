<script lang="ts">
    import type { Station } from "@repo/data";
    import {
        BookOpenIcon,
        ExternalLinkIcon,
        RadioTowerIcon,
        SaveIcon,
        Trash2Icon,
        XIcon,
    } from "@lucide/svelte";
    import WikipediaInfo from "$lib/components/WikipediaInfo.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import * as Select from "$lib/components/ui/select";
    import { Separator } from "$lib/components/ui/separator";
    import { stationStore } from "$lib/stores/stations";

    let {
        station,
        isSaving,
        onSave,
        onDelete,
        onClose,
    }: {
        station: Station;
        isSaving: boolean;
        onSave: (updates: {
            name: string;
            geo: { lat: number; lng: number };
            type: "rail" | "metro" | "light";
            importance: 1 | 2 | 3 | 4;
        }) => void;
        onDelete: () => void;
        onClose: () => void;
    } = $props();

    let lastStationId = $state<string | null>(null);
    let name = $state("");
    let type = $state<"rail" | "metro" | "light">("rail");
    let importance = $state("4");
    let lat = $state("");
    let lng = $state("");

    $effect(() => {
        if (station.id === lastStationId) return;
        lastStationId = station.id;
        name = station.name;
        type = station.type;
        importance = station.importance.toString();
        lat = station.geo?.lat.toString() ?? "";
        lng = station.geo?.lng.toString() ?? "";
    });

    const hasChanges = $derived(
        name !== station.name ||
            type !== station.type ||
            Number(importance) !== station.importance ||
            lat !== (station.geo?.lat.toString() ?? "") ||
            lng !== (station.geo?.lng.toString() ?? ""),
    );

    function handleSave() {
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) return;
        onSave({
            name,
            geo: { lat: parsedLat, lng: parsedLng },
            type,
            importance: Number(importance) as 1 | 2 | 3 | 4,
        });
    }

    const isItalianStation = $derived(/^IT[LM]?/.test(station.id));
    const railRadarBaseUrl = $derived(
        $stationStore.mode === "local"
            ? "http://localhost:3000"
            : "https://railradar24.com",
    );

    function handleLatPaste(event: ClipboardEvent) {
        const pasted = event.clipboardData?.getData("text") ?? "";
        const match = pasted.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
        if (!match?.[1] || !match[2]) return;

        event.preventDefault();
        lat = match[1];
        lng = match[2];
    }
</script>

<aside
    class="flex h-full w-[24rem] shrink-0 flex-col border-l border-border bg-card text-card-foreground max-lg:w-88 max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-20 max-md:max-w-[calc(100vw-2rem)]"
>
    <div class="border-b border-border px-4 py-3">
        <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
                <div
                    class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                    Inspector
                </div>
                <h2 class="mt-1 truncate text-sm font-semibold">
                    {name || "Unnamed station"}
                </h2>
                <p
                    class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground"
                >
                    {station.id}
                </p>
            </div>
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onclick={onClose}
            >
                <XIcon class="size-4" />
            </Button>
        </div>
    </div>

    <ScrollArea class="min-h-0 flex-1">
        <div class="flex flex-col gap-4 px-4 py-4">
            <div class="flex flex-col gap-1.5">
                <Label for="station-name">Name</Label>
                <p class="text-xs text-muted-foreground">
                    Display name shown in the app
                </p>
                <Input
                    id="station-name"
                    bind:value={name}
                    placeholder="Station name"
                />
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                    <Label>Type</Label>
                    <Select.Root type="single" bind:value={type}>
                        <Select.Trigger class="w-full">
                            {type === "rail"
                                ? "Rail"
                                : type === "metro"
                                  ? "Metro"
                                  : "Light"}
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="rail">Rail</Select.Item>
                            <Select.Item value="metro">Metro</Select.Item>
                            <Select.Item value="light">Light</Select.Item>
                        </Select.Content>
                    </Select.Root>
                </div>

                <div class="flex flex-col gap-1.5">
                    <Label>Importance</Label>
                    <Select.Root type="single" bind:value={importance}>
                        <Select.Trigger class="w-full">
                            {importance} - {importance === "1"
                                ? "Major"
                                : importance === "2"
                                  ? "Important"
                                  : importance === "3"
                                    ? "Medium"
                                    : "Minor"}
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="1">1 - Major</Select.Item>
                            <Select.Item value="2">2 - Important</Select.Item>
                            <Select.Item value="3">3 - Medium</Select.Item>
                            <Select.Item value="4">4 - Minor</Select.Item>
                        </Select.Content>
                    </Select.Root>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                    <Label for="station-lat">Latitude</Label>
                    <p class="text-xs text-muted-foreground">
                        North-south position
                    </p>
                    <Input
                        id="station-lat"
                        type="number"
                        step="0.000001"
                        bind:value={lat}
                        onpaste={handleLatPaste}
                    />
                </div>
                <div class="flex flex-col gap-1.5">
                    <Label for="station-lng">Longitude</Label>
                    <p class="text-xs text-muted-foreground">
                        East-west position
                    </p>
                    <Input
                        id="station-lng"
                        type="number"
                        step="0.000001"
                        bind:value={lng}
                    />
                </div>
            </div>

            <Separator />

            <div class="grid grid-cols-2 gap-2">
                {#if lat && lng}
                    <Button
                        variant="outline"
                        href={`https://www.google.com/maps?q=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <ExternalLinkIcon class="size-4" />
                        Google Maps
                    </Button>
                {/if}
                <Button
                    variant="outline"
                    href={`${railRadarBaseUrl}/station/${station.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <ExternalLinkIcon class="size-4" />
                    Rail Radar
                </Button>
                {#if isItalianStation}
                    <Button
                        variant="outline"
                        class={lat && lng ? "col-span-2" : ""}
                        href={`https://iechub.rfi.it/ArriviPartenze/en/ArrivalsDepartures/Monitor?placeId=${station.id}&arrivals=False`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <RadioTowerIcon class="size-4" />
                        RFI Data
                    </Button>
                {/if}
            </div>

            <details class="border-t border-border pt-4" open>
                <summary
                    class="flex cursor-pointer items-center gap-2 text-sm font-medium"
                >
                    <BookOpenIcon class="size-4" />
                    Wikipedia Info
                </summary>
                <WikipediaInfo
                    stationName={station.name}
                    stationId={station.id}
                    currentCoordinates={lat && lng
                        ? { lat: parseFloat(lat), lng: parseFloat(lng) }
                        : null}
                    onUseCoordinates={(wikiLat, wikiLng) => {
                        lat = wikiLat.toString();
                        lng = wikiLng.toString();
                    }}
                />
            </details>
        </div>
    </ScrollArea>

    <div
        class="grid grid-cols-[1fr_auto] gap-2 border-t border-border bg-card px-4 py-3"
    >
        <Button
            disabled={!name.trim() || isSaving || !hasChanges}
            onclick={handleSave}
        >
            <SaveIcon class="size-4" />
            {isSaving ? "Saving..." : "Save"}
        </Button>
        <Button variant="destructive" disabled={isSaving} onclick={onDelete}>
            <Trash2Icon class="size-4" />
            Delete
        </Button>
    </div>
</aside>
