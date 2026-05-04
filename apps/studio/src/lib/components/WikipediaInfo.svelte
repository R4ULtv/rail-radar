<script lang="ts">
  import { ExternalLinkIcon, MapPinIcon } from "@lucide/svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import type { StationInfobox, StationStatus } from "$lib/types/wikipedia";
  import { fetchWikipediaStation } from "$lib/wikipedia";
  import { calculateDistance, formatDistance, getStationStatus } from "$lib/wikipedia-parser";

  let {
    stationName,
    stationId = null,
    currentCoordinates = null,
    onUseCoordinates,
  }: {
    stationName: string;
    stationId?: string | null;
    currentCoordinates?: { lat: number; lng: number } | null;
    onUseCoordinates: (lat: number, lng: number) => void;
  } = $props();

  const COUNTRY_LANG: Record<string, string> = {
    IT: "it", DE: "de", CH: "de", AT: "de", FR: "fr", BE: "fr",
    NL: "nl", DK: "da", NO: "no", SE: "sv", FI: "fi", GB: "en", IE: "en",
  };
  const lang = $derived(
    stationId ? (COUNTRY_LANG[stationId.slice(0, 2).toUpperCase()] ?? "en") : "en",
  );

  let data = $state<StationInfobox | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let loadVersion = 0;

  async function load(name: string, id: string | null) {
    const version = ++loadVersion;
    isLoading = true;
    error = null;
    try {
      const result = await fetchWikipediaStation(name, id);
      if (version !== loadVersion) return;
      data = result;
    } catch {
      if (version !== loadVersion) return;
      error = "Failed to load Wikipedia data";
    } finally {
      if (version !== loadVersion) return;
      isLoading = false;
    }
  }

  $effect(() => {
    if (stationName) void load(stationName, stationId);
  });

  function statusVariant(status: StationStatus): "default" | "secondary" | "destructive" | "outline" {
    if (status === "soppressa") return "destructive";
    if (status === "chiusa") return "outline";
    return "secondary";
  }
</script>

{#if isLoading}
  <div class="py-3 text-sm text-muted-foreground">Loading...</div>
{:else if error}
  <div class="py-3 text-sm text-muted-foreground">{error}</div>
{:else if !data}
  <div class="flex flex-col gap-2 py-2">
    <p class="text-sm text-muted-foreground">No Wikipedia article found</p>
    <Button
      variant="outline"
      class="w-full"
      target="_blank"
      rel="noopener noreferrer"
      href={`https://${lang}.wikipedia.org/w/index.php?search=${encodeURIComponent(stationName)}`}
    >
      Search on Wikipedia
    </Button>
  </div>
{:else}
  {@const status = getStationStatus(data.stato)}
  {@const distance = data.coordinates && currentCoordinates ? calculateDistance(currentCoordinates.lat, currentCoordinates.lng, data.coordinates.lat, data.coordinates.lng) : null}
  <div class="flex flex-col gap-3 py-2">
    {#if data.stato}
      <Badge variant={statusVariant(status)} class="w-fit capitalize">{data.stato}</Badge>
    {/if}

    {#if data.coordinates}
      <div class="rounded-md border border-border bg-muted/30 p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <MapPinIcon class="size-4 text-muted-foreground" />
            <span class="font-mono text-xs">
              {data.coordinates.lat.toFixed(6)}, {data.coordinates.lng.toFixed(6)}
            </span>
          </div>
          <Button variant="outline" size="sm" onclick={() => onUseCoordinates(data!.coordinates!.lat, data!.coordinates!.lng)}>
            Use
          </Button>
        </div>
        {#if distance !== null}
          <div class="mt-2 text-xs text-muted-foreground">
            {#if distance < 1}
              <span class="text-emerald-300">Coordinates match</span>
            {:else}
              Distance from current: <span class="font-medium text-foreground">{formatDistance(distance)}</span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    {#if data.wikipediaUrl}
      <Button variant="outline" class="w-full" href={data.wikipediaUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLinkIcon class="size-4" />
        View on Wikipedia
      </Button>
    {/if}
  </div>
{/if}
