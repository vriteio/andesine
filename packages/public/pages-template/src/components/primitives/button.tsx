import clsx from "clsx";
import { type JSX, type ParentComponent, mergeProps, Show, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: ButtonColor;
  variant?: ButtonVariant;
  size?: ButtonSize;
  text?: ButtonText;
  /** Renders an `<a>` element. */
  link?: string;
  target?: string;
  /** Renders a non-interactive `<div>` element. */
  badge?: boolean;
}

interface IconButtonProps extends ButtonProps {
  icon: string;
  label?: string;
  iconClass?: string;
}

type ButtonColor = "base" | "contrast" | "primary";
type ButtonVariant = "solid" | "text" | "outlined";
type ButtonSize = "xs" | "small" | "medium";
type ButtonText = "base" | "soft" | "softer";

const sizeClasses: Record<ButtonSize, string> = {
  xs: ":base: px-1 py-0.5 text-xs",
  small: ":base: px-1.5 py-1 text-sm",
  medium: ":base: px-2 py-1 text-base"
};
const colorClasses: Record<ButtonColor, string> = {
  base: ":base: bg-gray-200 outline-gray-200",
  contrast: ":base: bg-white outline-gray-200 shadow-gray-200",
  primary: ":base: bg-gradient-to-tr bg-[length:125%_auto] text-white outline-tertiary"
};
const variantClasses: Record<ButtonVariant, string> = {
  solid: ":base: focus:outline-none",
  text: ":base: bg-transparent focus:outline-none",
  outlined: ":base: outline outline-1 -outline-offset-1 shadow-md focus-visible:outline-1"
};
const textClasses: Record<ButtonText, string> = {
  base: ":base: text-gray-700",
  soft: ":base: text-gray-400",
  softer: ":base: text-gray-500"
};
const iconButtonSizes: Record<ButtonSize, Record<"button" | "icon" | "label", string>> = {
  xs: { button: ":base-2: p-1", icon: ":base: h-4.5 w-4.5", label: ":base: pl-1" },
  small: { button: ":base-2: p-1", icon: ":base: h-5 w-5", label: ":base: pl-1" },
  medium: { button: ":base-2: p-1", icon: ":base: h-6 w-6", label: ":base: pl-1" }
};

// Keyboard focus shows the hover style.
const getHoverClasses = (color: ButtonColor, variant: ButtonVariant): string => {
  if (color === "primary") return ":base: @hover:bg-right focus-visible:bg-right";
  if (color === "contrast") return ":base: @hover:bg-gray-100 focus-visible:bg-gray-100";
  if (variant === "text") return ":base: @hover:bg-gray-200 focus-visible:bg-gray-200";

  return ":base: @hover:(shadow-inner outline-gray-300) focus-visible:(shadow-inner outline-gray-300)";
};
const Button: ParentComponent<ButtonProps> = (providedProps) => {
  const props = mergeProps(
    { color: "base", variant: "solid", size: "medium" } as const,
    providedProps
  );
  const [local, rest] = splitProps(props, [
    "class",
    "color",
    "variant",
    "size",
    "text",
    "link",
    "badge"
  ]);
  const component = (): "a" | "div" | "button" => {
    if (local.link) return "a";
    if (local.badge) return "div";

    return "button";
  };

  return (
    <Dynamic
      component={component()}
      {...rest}
      href={local.link}
      type={component() === "button" ? (rest.type ?? "button") : undefined}
      class={clsx(
        ":base: relative inline-flex items-center justify-center rounded-lg font-medium transition-[background-position,background-color,box-shadow,opacity] duration-200 ease-out disabled:opacity-70",
        !local.badge && ":base: cursor-pointer",
        sizeClasses[local.size],
        variantClasses[local.variant],
        local.variant !== "text" && colorClasses[local.color],
        local.text && textClasses[local.text],
        getHoverClasses(local.color, local.variant),
        local.class
      )}
    />
  );
};
const IconButton: ParentComponent<IconButtonProps> = (providedProps) => {
  const props = mergeProps({ size: "medium" } as const, providedProps);
  const [local, rest] = splitProps(props, ["class", "icon", "label", "iconClass", "children"]);

  return (
    <Button {...rest} class={clsx(iconButtonSizes[props.size].button, local.class)}>
      <span
        aria-hidden="true"
        class={clsx("shrink-0", iconButtonSizes[props.size].icon, local.icon, local.iconClass)}
      />
      <Show when={local.label}>
        <span class={clsx("truncate", iconButtonSizes[props.size].label)}>{local.label}</span>
      </Show>
      {local.children}
    </Button>
  );
};

export { Button, IconButton };
export type { ButtonProps, IconButtonProps };
