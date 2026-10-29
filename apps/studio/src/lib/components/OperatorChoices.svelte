<script lang="ts" generics="T extends string">
  import { Checkbox } from "$lib/components/ui/checkbox";
  import * as Field from "$lib/components/ui/field";

  let {
    label,
    id,
    options,
    values = $bindable(),
  }: {
    label: string;
    id: string;
    options: Record<T, string>;
    values: T[];
  } = $props();
</script>

<Field.Set>
  <Field.Legend variant="label">{label}</Field.Legend>
  <Field.Group class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {#each Object.keys(options) as key (key)}
      {@const value = key as T}
      <Field.Field orientation="horizontal">
        <Checkbox
          id={`${id}-${value}`}
          checked={values.includes(value)}
          onCheckedChange={(checked) => {
            values = checked ? [...values, value] : values.filter((item) => item !== value);
          }}
        />
        <Field.Label for={`${id}-${value}`}>{options[value]}</Field.Label>
      </Field.Field>
    {/each}
  </Field.Group>
</Field.Set>
