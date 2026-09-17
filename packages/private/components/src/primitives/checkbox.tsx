import { Checkbox as BaseCheckbox } from "@ark-ui/solid/checkbox";
import clsx from "clsx";
import { type Component } from "solid-js";

interface CheckboxProps {
  controlClass?: string;
  iconClass?: string;
  size?: CheckboxSize;
  disabled?: boolean;
  checked?: boolean | "indeterminate";
  setChecked?(checked: boolean): void;
}

type CheckboxSize = "small" | "medium" | "large";

const sizeClasses: Record<CheckboxSize, { control: string; icon: string }> = {
  small: { control: ":base: w-5 h-5 rounded-md", icon: ":base: w-4 h-4" },
  medium: { control: ":base: w-6 h-6 rounded-lg", icon: ":base: w-5 h-5" },
  large: { control: ":base: w-8 h-8 rounded-lg", icon: ":base: w-6 h-6" }
};

const Checkbox: Component<CheckboxProps> = (props) => (
  <BaseCheckbox.Root
    checked={props.checked}
    onCheckedChange={(details) => {
      props.setChecked?.(details.checked === true);
    }}
    disabled={props.disabled}
  >
    <BaseCheckbox.Control
      class={clsx(
        `:base: flex items-center justify-center outline outline-2 -outline-offset-2 cursor-pointer`,
        `:base: outline-gray-400`,
        `:base: data-[state=checked]:outline-transparent data-[state=checked]:bg-gradient-to-tr`,
        `:base: data-[state=indeterminate]:outline-transparent data-[state=indeterminate]:bg-gradient-to-tr`,
        `:base: data-[disabled]:opacity-70 data-[disabled]:pointer-events-none`,
        sizeClasses[props.size || "medium"].control,
        props.controlClass
      )}
    >
      <BaseCheckbox.Indicator>
        <div
          class={clsx(
            ":base: text-white",
            props.checked === "indeterminate" ? "i-lucide:minus" : "i-lucide:check",
            sizeClasses[props.size || "medium"].icon,
            props.iconClass
          )}
        />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Control>
    <BaseCheckbox.HiddenInput />
  </BaseCheckbox.Root>
);

export { Checkbox };
export type { CheckboxProps };
