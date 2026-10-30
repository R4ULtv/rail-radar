<script lang="ts">
  import type { FreightKind, Station } from "@repo/data";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Select from "$lib/components/ui/select";
  import { freightKindLabels, isValidStationId } from "$lib/stations";

  let {
    open,
    existingIds,
    existingPrefixes,
    initialType = "rail",
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    existingIds: Map<string, string>;
    existingPrefixes: Set<string>;
    initialType?: Station["type"];
    onConfirm: (id: string, name: string, type: Station["type"], kind?: FreightKind) => void;
    onCancel: () => void;
  } = $props();

  let id = $state("");
  let name = $state("New Station");
  let type = $state<Station["type"]>("rail");
  let kind = $state<FreightKind | "unspecified">("unspecified");

  const typeLabels: Record<Station["type"], string> = {
    rail: "Rail",
    metro: "Metro",
    light: "Light rail",
    freight: "Freight yard",
  };

  $effect(() => {
    if (open) {
      id = "";
      name = initialType === "freight" ? "New Yard" : "New Station";
      type = initialType;
      kind = "unspecified";
    }
  });

  const trimmedId = $derived(id.trim().toUpperCase());
  const formatValid = $derived(trimmedId.length === 0 || isValidStationId(trimmedId));
  const duplicateName = $derived(
    trimmedId.length > 0 ? (existingIds.get(trimmedId) ?? null) : null,
  );
  const error = $derived(
    trimmedId.length === 0
      ? "ID is required"
      : !formatValid
        ? "Format: 2-3 letter prefix + at least 3 digits (e.g. IT123, ITM042, BE11007)"
        : duplicateName !== null
          ? `ID "${trimmedId}" already exists — "${duplicateName}"`
          : null,
  );
  const enteredPrefix = $derived(trimmedId.match(/^[A-Z]+/)?.[0] ?? "");
  const enteredDigits = $derived(trimmedId.match(/\d+$/)?.[0] ?? "");
  const showPrefixHint = $derived(
    !error && enteredPrefix.length > 0 && !existingPrefixes.has(enteredPrefix),
  );
  const showDigitLengthHint = $derived(!error && enteredDigits.length > 8);
  const sortedPrefixes = $derived([...existingPrefixes].sort());
  const canSubmit = $derived(!error && name.trim().length > 0);

  function handleSubmit(event: Event) {
    event.preventDefault();
    if (!canSubmit) return;
    onConfirm(
      trimmedId,
      name.trim(),
      type,
      type === "freight" && kind !== "unspecified" ? kind : undefined,
    );
  }

  function handleOpenChange(next: boolean) {
    if (!next) onCancel();
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>New station or yard</Dialog.Title>
      <Dialog.Description>
        Choose an ID. Format is a 2-3 letter country prefix (e.g. <code>IT</code>, <code>ITM</code>,
        <code>BE</code>, <code>UK</code>) followed by 3+ digits — typically 6 to 8.
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={handleSubmit} class="flex flex-col gap-4 py-2">
      <div class="flex flex-col gap-1.5">
        <Label for="new-station-id">Station ID</Label>
        <Input
          id="new-station-id"
          bind:value={id}
          placeholder="ITM042"
          autocomplete="off"
          autocapitalize="characters"
          class="font-mono"
        />
        {#if error}
          <p class="text-xs text-destructive">{error}</p>
        {:else if showPrefixHint}
          <div
            class="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200"
          >
            <p>
              Prefix <code class="font-mono">{enteredPrefix}</code> doesn't exist yet. Existing prefixes:
            </p>
            <p class="mt-1 font-mono text-[11px]">{sortedPrefixes.join(", ")}</p>
          </div>
        {:else if showDigitLengthHint}
          <p class="text-xs text-amber-200">
            Heads up — IDs are usually 6-8 digits, you entered {enteredDigits.length}.
          </p>
        {/if}
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="new-station-name">Name</Label>
        <Input id="new-station-name" bind:value={name} placeholder="Station name" />
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="new-station-type">Type</Label>
        <Select.Root type="single" bind:value={type}>
          <Select.Trigger id="new-station-type" class="w-full">{typeLabels[type]}</Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each Object.entries(typeLabels) as [value, label] (value)}
                <Select.Item {value}>{label}</Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </div>

      {#if type === "freight"}
        <div class="flex flex-col gap-1.5">
          <Label for="new-station-kind">Yard kind</Label>
          <Select.Root type="single" bind:value={kind}>
            <Select.Trigger id="new-station-kind" class="w-full">
              {kind === "unspecified" ? "Unspecified" : freightKindLabels[kind]}
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                <Select.Item value="unspecified">Unspecified</Select.Item>
                {#each Object.entries(freightKindLabels) as [value, label] (value)}
                  <Select.Item {value}>{label}</Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </div>
      {/if}

      <div class="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onclick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={!canSubmit}>Create</Button>
      </div>
    </form>
  </Dialog.Content>
</Dialog.Root>
