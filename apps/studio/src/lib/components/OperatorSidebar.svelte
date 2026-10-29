<script lang="ts">
  import type { Operator } from "@repo/data";
  import { onMount, tick } from "svelte";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import * as Select from "$lib/components/ui/select";
  import * as Empty from "$lib/components/ui/empty";
  import {
    operatorCountryLabels,
    operatorTypeLabels,
    type OperatorCountryFilter,
    type OperatorTypeFilter,
  } from "$lib/operators";
  import OperatorLogo from "$lib/components/OperatorLogo.svelte";
  import { cn } from "$lib/utils";

  let {
    operators,
    total,
    selectedSlug,
    editorOpen,
    local,
    busy,
    search = $bindable(""),
    typeFilter = $bindable<OperatorTypeFilter>("all"),
    countryFilter = $bindable<OperatorCountryFilter>("all"),
    onSelect,
  }: {
    operators: Operator[];
    total: number;
    selectedSlug: string | null;
    editorOpen: boolean;
    local: boolean;
    busy: boolean;
    search?: string;
    typeFilter?: OperatorTypeFilter;
    countryFilter?: OperatorCountryFilter;
    onSelect: (operator: Operator) => void;
  } = $props();

  let searchInput = $state<HTMLInputElement | null>(null);
  let list = $state<HTMLDivElement | null>(null);

  onMount(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput?.focus();
        searchInput?.select();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });

  async function navigate(event: KeyboardEvent, index: number) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? operators.length - 1
          : Math.max(
              0,
              Math.min(operators.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)),
            );
    const operator = operators[nextIndex];
    if (!operator) return;
    onSelect(operator);
    await tick();
    list?.querySelectorAll<HTMLButtonElement>("button[data-operator]")[nextIndex]?.focus();
  }
</script>

<aside
  class={cn(
    "flex min-h-0 w-80 shrink-0 flex-col border-r border-sidebar-border bg-sidebar max-lg:w-72 max-md:w-full",
    editorOpen && "max-md:hidden",
  )}
  aria-label="Operators"
>
  <div class="flex flex-col gap-3 border-b border-sidebar-border p-3">
    <div class="flex items-baseline justify-between">
      <h2 class="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        Operators
      </h2>
      <span class="font-mono text-[11px] text-muted-foreground">{operators.length} / {total}</span>
    </div>
    <Input
      bind:ref={searchInput}
      bind:value={search}
      placeholder="Name, slug or country..."
      aria-label="Search operators"
      disabled={busy}
    />
    <div class="grid grid-cols-2 gap-2">
      <Select.Root type="single" bind:value={typeFilter} disabled={busy}>
        <Select.Trigger class="w-full" aria-label="Filter by operator type"
          >{typeFilter === "all" ? "All types" : operatorTypeLabels[typeFilter]}</Select.Trigger
        >
        <Select.Content
          ><Select.Group
            ><Select.Item value="all">All types</Select.Item
            >{#each Object.entries(operatorTypeLabels) as [value, label] (value)}<Select.Item
                {value}>{label}</Select.Item
              >{/each}</Select.Group
          ></Select.Content
        >
      </Select.Root>
      <Select.Root type="single" bind:value={countryFilter} disabled={busy}>
        <Select.Trigger class="w-full" aria-label="Filter by country"
          ><span class="truncate"
            >{countryFilter === "all"
              ? "All countries"
              : operatorCountryLabels[countryFilter]}</span
          ></Select.Trigger
        >
        <Select.Content
          ><Select.Group
            ><Select.Item value="all">All countries</Select.Item
            >{#each Object.entries(operatorCountryLabels) as [value, label] (value)}<Select.Item
                {value}>{label}</Select.Item
              >{/each}</Select.Group
          ></Select.Content
        >
      </Select.Root>
    </div>
  </div>
  <ScrollArea class="min-h-0 flex-1">
    <div bind:this={list}>
      {#each operators as operator, index (operator.slug)}
        <Button
          data-operator={operator.slug}
          variant="ghost"
          disabled={busy}
          aria-current={selectedSlug === operator.slug ? "true" : undefined}
          class={cn(
            "h-auto w-full justify-start gap-3 border-l-2 border-l-transparent px-3 py-3 text-left",
            selectedSlug === operator.slug && "border-l-primary bg-muted",
          )}
          onclick={() => onSelect(operator)}
          onkeydown={(event) => navigate(event, index)}
        >
          <OperatorLogo path={operator.logoPath} {local} />
          <span class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="truncate">{operator.name}</span>
            <span class="truncate text-[10px] text-muted-foreground"
              >{operator.operatorTypes.map((type) => operatorTypeLabels[type]).join(" · ")} · {operator.countries
                .map((country) => country.toUpperCase())
                .join(", ")}</span
            >
          </span>
        </Button>
      {:else}
        <Empty.Root
          ><Empty.Header
            ><Empty.Title>No operators found</Empty.Title><Empty.Description
              >Try another name, type or country.</Empty.Description
            ></Empty.Header
          ></Empty.Root
        >
      {/each}
    </div>
  </ScrollArea>
</aside>
