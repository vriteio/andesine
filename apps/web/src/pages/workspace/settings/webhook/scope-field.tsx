import { Combobox, TagList } from "@andesine/components";
import { type Component, createMemo, Show } from "solid-js";
import { MAX_SELECTED_SCOPE_ITEMS } from "./configuration";

interface ScopeFieldOption {
  value: string;
  label: string;
  icon?: string;
}
interface ScopeFieldProps {
  disabled?: boolean;
  // Shown when nothing is selected, which means everything is included.
  emptyLabel: string;
  options: ScopeFieldOption[];
  placeholder: string;
  values: string[];
  // Labels for stored values, including values that are no longer offered as options.
  getLabel(value: string): string;
  setValues(values: string[]): void;
}

const ScopeField: Component<ScopeFieldProps> = (props) => {
  const availableOptions = createMemo(() => {
    const selected = new Set(props.values);

    return props.options.filter((option) => !selected.has(option.value));
  });
  const optionsByValue = createMemo(() => {
    return new Map(props.options.map((option) => [option.value, option]));
  });
  const limitReached = () => props.values.length >= MAX_SELECTED_SCOPE_ITEMS;

  return (
    <div class="flex w-62 max-w-full flex-col items-end gap-2">
      <Show when={!props.disabled}>
        <Combobox
          options={availableOptions()}
          placeholder={
            limitReached() ? `Up to ${MAX_SELECTED_SCOPE_ITEMS} items` : props.placeholder
          }
          disabled={limitReached()}
          portal={false}
          setValue={(value) => props.setValues([...props.values, value])}
        />
      </Show>
      <Show
        when={props.values.length}
        fallback={<span class="text-sm text-gray-400">{props.emptyLabel}</span>}
      >
        <TagList
          class="justify-end"
          values={props.values}
          disabled={props.disabled}
          getLabel={props.getLabel}
          getIcon={(value) => optionsByValue().get(value)?.icon || "i-lucide:circle-help"}
          setValues={props.setValues}
        />
      </Show>
    </div>
  );
};

export { ScopeField };
export type { ScopeFieldOption };
