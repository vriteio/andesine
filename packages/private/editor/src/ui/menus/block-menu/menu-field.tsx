import { Input } from "@andesine/components";
import { createSignal } from "solid-js";

interface MenuFieldProps {
  label: string;
  placeholder: string;
  value(): string;
  commit(value: string): void;
}

/** A text field in a block menu that saves a changed value on confirm or blur. */
const MenuField = (props: MenuFieldProps) => {
  const [value, setValue] = createSignal(props.value());

  let committedValue = value();

  const commit = () => {
    const nextValue = value();

    if (nextValue === committedValue) return;
    if (nextValue !== props.value()) props.commit(nextValue);

    committedValue = nextValue;
  };

  return (
    <div class="w-full min-w-0 p-1">
      <Input
        class="w-full min-w-0 bg-gray-50"
        label={props.label}
        placeholder={props.placeholder}
        maxLength={2000}
        value={value()}
        setValue={setValue}
        onConfirm={commit}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
};

export { MenuField };
