import { PinInput } from "@ark-ui/solid/pin-input";
import clsx from "clsx";
import { type Component, Index, type JSX, Show } from "solid-js";

interface OTPInputSlotProps {
  index: number;
  length: number;
  color?: "base" | "contrast";
  variant?: "solid" | "outlined";
}
interface OTPInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "type"> {
  length?: number;
  controlClass?: string;
  type?: "numeric" | "alphanumeric" | "alphabetic";
  color?: "base" | "contrast";
  variant?: "solid" | "outlined";
  value: string;
  setValue?(value: string): void;
  sanitizeValue?(value: string): string;
  onEnter?(event: KeyboardEvent): void;
}
const OTPInputColors = {
  base: `:base: bg-gray-200 outline-gray-200`,
  contrast: `:base: bg-white outline-gray-200 shadow-gray-200`
};
const OTPInputVariants = {
  solid: `:base: focus:outline-none focus:shadow-inner`,
  outlined: `:base: outline outline-1 shadow-md focus:outline-1 focus:bg-gray-100`
};

const OTPInputSlot: Component<OTPInputSlotProps> = (props) => (
  <div class="flex-1 min-w-0">
    <PinInput.Input
      index={props.index}
      class={clsx(
        ":base: rounded-md h-full w-full min-w-0 flex justify-center items-center text-2xl font-semibold text-center",
        OTPInputColors[props.color || "base"],
        OTPInputVariants[props.variant || "solid"],
        props.index === 0 && "rounded-l-lg",
        props.index === props.length - 1 && "rounded-r-lg"
      )}
    />
  </div>
);
const OTPInput: Component<OTPInputProps> = (props) => {
  const length = () => props.length || 6;
  const slots = () => Array.from({ length: length() }).map((_, index) => index);
  const arrayValue = () => Array.from({ length: length() }, (_, index) => props.value[index] || "");

  return (
    <PinInput.Root
      class={clsx("flex h-12 gap-2", props.class)}
      role="group"
      aria-label={props["aria-label"]}
      type={props.type || "numeric"}
      count={length()}
      disabled={props.disabled}
      readOnly={props.readOnly}
      sanitizeValue={props.sanitizeValue}
      value={arrayValue()}
      placeholder=""
      onValueChange={(details) => {
        props.setValue?.(details.valueAsString);
      }}
      onKeyUp={(event) => {
        if (event.key === "Enter" && !props.disabled && !props.readOnly) {
          props.onEnter?.(event);
        }
      }}
      otp={!props.type || props.type === "numeric"}
    >
      <PinInput.Control class={clsx(":base: flex h-12 w-full min-w-0 gap-2", props.controlClass)}>
        <Index each={slots()}>
          {(index) => (
            <>
              <OTPInputSlot
                index={index()}
                length={length()}
                color={props.color}
                variant={props.variant}
              />
              <Show when={index() + 1 === length() / 2}>
                <div aria-hidden="true" class="w-4 shrink-0 flex justify-center items-center">
                  <div class="h-0.5 w-full bg-gray-400 rounded-full" />
                </div>
              </Show>
            </>
          )}
        </Index>
      </PinInput.Control>
      <PinInput.HiddenInput />
    </PinInput.Root>
  );
};
export { OTPInput };
