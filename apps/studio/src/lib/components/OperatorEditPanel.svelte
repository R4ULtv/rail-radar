<script lang="ts">
  import type { Line, Operator } from "@repo/data";
  import { ExternalLinkIcon, PlusIcon, SaveIcon, Trash2Icon, XIcon } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import * as Field from "$lib/components/ui/field";
  import * as Alert from "$lib/components/ui/alert";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import * as Select from "$lib/components/ui/select";
  import OperatorChoices from "$lib/components/OperatorChoices.svelte";
  import OperatorLogo from "$lib/components/OperatorLogo.svelte";
  import {
    operatorCountryLabels,
    operatorLinkTypes,
    operatorTypeLabels,
    serviceTypeLabels,
  } from "$lib/operators";

  let {
    draft = $bindable(),
    original,
    lines,
    local,
    busy,
    dirty,
    error,
    onSave,
    onDelete,
    onClose,
  }: {
    draft: Operator;
    original: Operator | null;
    lines: Line[];
    local: boolean;
    busy: boolean;
    dirty: boolean;
    error: string | null;
    onSave: () => void;
    onDelete: () => void;
    onClose: () => void;
  } = $props();

  const servingLines = $derived(lines.filter((line) => line.operator === original?.slug));
  const slugLocked = $derived(servingLines.length > 0);
  let errorRef = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (error) errorRef?.focus();
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!busy) onSave();
  }
</script>

<section class="flex min-h-0 min-w-0 flex-1 flex-col bg-background" aria-label="Operator editor">
  <div
    class="flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-8"
  >
    <div class="flex min-w-0 items-center gap-4">
      <OperatorLogo path={draft.logoPath} {local} class="size-16" />
      <div class="min-w-0">
        <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {original ? "Operator profile" : "New operator"}
        </p>
        <h1 class="mt-1 truncate text-xl font-semibold tracking-tight">
          {draft.name || "Unnamed operator"}
        </h1>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span class="font-mono text-xs text-muted-foreground"
            >{draft.slug || "Choose a slug"}</span
          >
          {#each draft.operatorTypes as type (type)}
            <Badge variant="secondary">{operatorTypeLabels[type]}</Badge>
          {/each}
        </div>
      </div>
    </div>
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={busy}
      onclick={onClose}
      aria-label="Close operator editor"><XIcon /></Button
    >
  </div>

  <ScrollArea class="min-h-0 flex-1">
    <form id="operator-form" onsubmit={submit} class="mx-auto max-w-5xl p-5 sm:p-8">
      <fieldset disabled={busy} class="min-w-0 disabled:opacity-60">
        <Field.Group class="gap-8">
          {#if error}
            <Alert.Root bind:ref={errorRef} tabindex={-1} variant="destructive" role="alert"
              ><Alert.Title>Unable to save operator</Alert.Title><Alert.Description
                >{error}</Alert.Description
              ></Alert.Root
            >
          {/if}

          <Field.Set>
            <Field.Legend>Identity</Field.Legend>
            <Field.Group class="grid gap-4 sm:grid-cols-2">
              <Field.Field>
                <Field.Label for="operator-name">Name</Field.Label>
                <Input
                  id="operator-name"
                  bind:value={draft.name}
                  required
                  placeholder="Operator name"
                />
              </Field.Field>
              <Field.Field>
                <Field.Label for="operator-slug">Slug</Field.Label>
                <Input
                  id="operator-slug"
                  bind:value={draft.slug}
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  readonly={slugLocked}
                  aria-describedby="operator-slug-help"
                  placeholder="e.g. sbb-cargo"
                  class="font-mono"
                />
                <Field.Description id="operator-slug-help"
                  >{slugLocked
                    ? "Used by saved lines. Reassign those lines before renaming this operator."
                    : "Public identifier used in operator URLs and line assignments."}</Field.Description
                >
              </Field.Field>
              <Field.Field>
                <Field.Label for="operator-website">Website</Field.Label>
                <Input
                  id="operator-website"
                  type="url"
                  bind:value={draft.website}
                  required
                  placeholder="https://"
                />
              </Field.Field>
              <Field.Field>
                <Field.Label for="operator-logo">Logo path</Field.Label>
                <Input
                  id="operator-logo"
                  bind:value={draft.logoPath}
                  required
                  placeholder="e.g. ch/sbb-cargo"
                  class="font-mono"
                />
                <Field.Description
                  >Existing SVG asset path, without the .svg extension.</Field.Description
                >
              </Field.Field>
              <Field.Field class="sm:col-span-2">
                <Field.Label for="operator-description">Description</Field.Label>
                <Textarea
                  id="operator-description"
                  bind:value={draft.description}
                  rows={5}
                  placeholder="Describe the operator and its network in English."
                />
              </Field.Field>
            </Field.Group>
          </Field.Set>

          <OperatorChoices
            id="operator-types"
            label="Operator types"
            options={operatorTypeLabels}
            bind:values={draft.operatorTypes}
          />
          <OperatorChoices
            id="operator-countries"
            label="Countries served"
            options={operatorCountryLabels}
            bind:values={draft.countries}
          />
          <OperatorChoices
            id="operator-services"
            label="Services"
            options={serviceTypeLabels}
            bind:values={draft.serviceTypes}
          />

          <Field.Set>
            <Field.Legend>Network bounds</Field.Legend>
            <Field.Description
              >Geographic extent of the network. West must be less than east; south must be less
              than north.</Field.Description
            >
            <Field.Group class="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {#each ["West", "South", "East", "North"] as label, index (label)}
                <Field.Field>
                  <Field.Label for={`operator-bound-${index}`}>{label}</Field.Label>
                  <Input
                    id={`operator-bound-${index}`}
                    type="number"
                    step="any"
                    min={index % 2 === 0 ? -180 : -90}
                    max={index % 2 === 0 ? 180 : 90}
                    required
                    value={draft.bounds[index]}
                    oninput={(event) => (draft.bounds[index] = event.currentTarget.valueAsNumber)}
                  />
                </Field.Field>
              {/each}
            </Field.Group>
          </Field.Set>

          <Field.Set>
            <Field.Legend>Company & statistics</Field.Legend>
            <Field.Description
              >Leave unknown values empty. Passenger totals can stay empty for freight operators.</Field.Description
            >
            <Field.Group class="grid gap-4 sm:grid-cols-2">
              <Field.Field>
                <Field.Label for="operator-founded">Founded</Field.Label>
                <Input
                  id="operator-founded"
                  type="number"
                  min="0"
                  step="1"
                  value={draft.founded ?? ""}
                  oninput={(event) =>
                    (draft.founded =
                      event.currentTarget.value === "" ? null : event.currentTarget.valueAsNumber)}
                />
              </Field.Field>
              <Field.Field>
                <Field.Label for="operator-headquarters">Headquarters</Field.Label>
                <Input
                  id="operator-headquarters"
                  value={draft.headquarters ?? ""}
                  oninput={(event) => (draft.headquarters = event.currentTarget.value || null)}
                />
              </Field.Field>
              <Field.Field>
                <Field.Label for="operator-network">Network length (km)</Field.Label>
                <Input
                  id="operator-network"
                  type="number"
                  min="0"
                  step="any"
                  value={draft.networkKm ?? ""}
                  oninput={(event) =>
                    (draft.networkKm =
                      event.currentTarget.value === "" ? null : event.currentTarget.valueAsNumber)}
                />
              </Field.Field>
              <Field.Field>
                <Field.Label for="operator-passengers">Annual passengers</Field.Label>
                <Input
                  id="operator-passengers"
                  type="number"
                  min="0"
                  step="1"
                  value={draft.annualPassengers ?? ""}
                  oninput={(event) =>
                    (draft.annualPassengers =
                      event.currentTarget.value === "" ? null : event.currentTarget.valueAsNumber)}
                />
              </Field.Field>
              <Field.Field class="sm:col-span-2">
                <Field.Label for="operator-parent">Parent company</Field.Label>
                <Input
                  id="operator-parent"
                  value={draft.parentCompany ?? ""}
                  oninput={(event) => (draft.parentCompany = event.currentTarget.value || null)}
                />
              </Field.Field>
            </Field.Group>
          </Field.Set>

          <Field.Set>
            <Field.Legend>Links</Field.Legend>
            <Field.Description
              >Official websites, timetables, APIs and Wikipedia pages.</Field.Description
            >
            <Field.Group class="gap-4">
              {#each draft.links as link, index (index)}
                <Field.Set class="border border-border p-3">
                  <Field.Legend variant="label">Link {index + 1}</Field.Legend>
                  <Field.Group class="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Field.Field>
                      <Field.Label for={`link-label-${index}`}>Label</Field.Label>
                      <Input id={`link-label-${index}`} bind:value={link.label} required />
                    </Field.Field>
                    <Field.Field>
                      <Field.Label for={`link-type-${index}`}>Type</Field.Label>
                      <Select.Root type="single" bind:value={link.type}>
                        <Select.Trigger id={`link-type-${index}`} class="w-full"
                          >{link.type}</Select.Trigger
                        >
                        <Select.Content
                          ><Select.Group
                            >{#each operatorLinkTypes as type (type)}<Select.Item value={type}
                                >{type}</Select.Item
                              >{/each}</Select.Group
                          ></Select.Content
                        >
                      </Select.Root>
                    </Field.Field>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="self-end"
                      onclick={() => (draft.links = draft.links.filter((_, i) => i !== index))}
                      aria-label={`Remove link ${index + 1}`}><Trash2Icon /></Button
                    >
                    <Field.Field class="sm:col-span-3">
                      <Field.Label for={`link-url-${index}`}>URL</Field.Label>
                      <Input
                        id={`link-url-${index}`}
                        type="url"
                        bind:value={link.url}
                        required
                        placeholder="https://"
                      />
                    </Field.Field>
                  </Field.Group>
                </Field.Set>
              {/each}
              <Button
                variant="outline"
                class="self-start"
                onclick={() => draft.links.push({ label: "", url: "", type: "website" })}
                ><PlusIcon data-icon="inline-start" />Add link</Button
              >
            </Field.Group>
          </Field.Set>

          {#if servingLines.length}
            <Field.Set>
              <Field.Legend>Assigned lines</Field.Legend>
              <Field.Description
                >{servingLines.length} lines reference this operator. Manage their assignments in the
                Lines workspace.</Field.Description
              >
              <div class="flex flex-wrap gap-2">
                {#each servingLines as line (line.id)}<Badge variant="outline"
                    >{line.code ? `${line.code} · ` : ""}{line.name}</Badge
                  >{/each}
              </div>
            </Field.Set>
          {/if}
          {#if original}
            <Button
              variant="outline"
              href={`https://railradar24.com/operators/${original.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              class="self-start"
              ><ExternalLinkIcon data-icon="inline-start" />View on Rail Radar</Button
            >
          {/if}
        </Field.Group>
      </fieldset>
    </form>
  </ScrollArea>

  <div
    class="flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-3 sm:px-8"
  >
    <p class="hidden text-xs text-muted-foreground sm:block">
      {dirty ? "Unsaved changes" : "All changes saved"}
    </p>
    <div class="ml-auto flex gap-2">
      {#if original}<Button
          variant="destructive"
          disabled={busy || slugLocked}
          title={slugLocked
            ? "Reassign this operator's lines before deleting it"
            : "Delete operator"}
          onclick={onDelete}><Trash2Icon data-icon="inline-start" />Delete</Button
        >{/if}
      <Button type="submit" form="operator-form" disabled={busy || !dirty}
        ><SaveIcon data-icon="inline-start" />{busy ? "Saving..." : "Save operator"}</Button
      >
    </div>
  </div>
</section>
