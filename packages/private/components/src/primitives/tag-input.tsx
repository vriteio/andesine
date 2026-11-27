import { type Component, type ComponentProps, createSignal, Show } from "solid-js";
import { Input } from "./input";
import { TagList } from "./tag-list";
import { Tooltip } from "./tooltip";
import clsx from "clsx";

interface TagInputProps {
  values: string[];
  commitOnEnter?: boolean;
  disabled?: boolean;
  disableAutoFocus?: boolean;
  label?: string;
  maxLength?: number;
  maxValues?: number;
  placeholder?: string;
  inputClass?: string;
  tagListClass?: string;
  /** Lists the tags above the input, instead of below it. */
  tagsFirst?: boolean;
  validate?(values: string[]): string | undefined;
  setValues?(values: string[]): void;
  /** The input's color; the default has a gray background. */
  color?: ComponentProps<typeof Input>["color"];
  /** The text not added as a tag yet. */
  onInputChange?(value: string): void;
}

const TagInput: Component<TagInputProps> = (props) => {
  const [inputValue, setInputValue] = createSignal("");
  const [touched, setTouched] = createSignal(false);
  const error = () => (touched() ? props.validate?.(props.values) : undefined);
  const maxValuesReached = () => {
    return typeof props.maxValues === "number" && props.values.length >= props.maxValues;
  };
  const setValues = (values: string[]) => {
    setTouched(true);
    props.setValues?.(values);
  };
  const updateInput = (value: string) => {
    setInputValue(value);
    props.onInputChange?.(value);
  };
  const addValue = () => {
    const value = inputValue().trim();

    setTouched(true);

    if (!value || props.values.includes(value) || maxValuesReached()) {
      updateInput("");
      return;
    }

    props.setValues?.([...props.values, value]);
    updateInput("");
  };

  const tagList = () => (
    <Show when={Boolean(props.values.length)}>
      <TagList
        values={props.values}
        disabled={props.disabled}
        setValues={setValues}
        class={props.tagListClass}
      />
    </Show>
  );

  return (
    <div class=":base: flex w-full min-w-0 flex-col gap-1">
      <Show when={props.tagsFirst}>{tagList()}</Show>
      <Input
        class={clsx(":base-2: w-full min-w-0", !props.color && "bg-gray-50", props.inputClass)}
        color={props.color}
        label={props.label}
        placeholder={props.placeholder}
        value={inputValue()}
        disabled={props.disabled || maxValuesReached()}
        maxLength={props.maxLength}
        data-no-autofocus={props.disableAutoFocus ? "" : undefined}
        setValue={updateInput}
        onKeyDown={(event) => event.stopPropagation()}
        onEnter={(event) => {
          const input = event.currentTarget;

          event.preventDefault();

          if (props.commitOnEnter === false && input instanceof HTMLInputElement) {
            input.blur();
            return;
          }

          addValue();
        }}
        onBlur={addValue}
        aria-invalid={Boolean(error())}
        slot={() => (
          <Show when={error()} keyed>
            {(error) => (
              <div class="absolute right-2">
                <Tooltip
                  content={<span class="max-w-48 whitespace-pre-wrap leading-tight">{error}</span>}
                >
                  <div class="h-4 w-4 text-red-500 i-lucide:triangle-alert" />
                </Tooltip>
              </div>
            )}
          </Show>
        )}
      />
      <Show when={!props.tagsFirst}>{tagList()}</Show>
    </div>
  );
};

export { TagInput };
