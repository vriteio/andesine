import clsx from "clsx";
import { type JSX, type ParentComponent, mergeProps, Show, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Defaults to `primary` for buttons and `secondary` for icon buttons. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** The gray level of `secondary` and `ghost` buttons; icon buttons default to `soft`. */
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

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "xs" | "small" | "medium";
type ButtonText = "base" | "soft" | "softer";

const sizeClasses: Record<ButtonSize, string> = {
  xs: ":base: px-1 py-0.5 text-xs",
  small: ":base: px-1.5 py-1 text-sm",
  medium: ":base: px-2 py-1 text-base"
};
const outlinedClasses =
  ":base: outline outline-1 -outline-offset-1 shadow-md focus-visible:outline-1";
// Keyboard focus shows the hover style.
const variantClasses: Record<ButtonVariant, string> = {
  primary: clsx(
    outlinedClasses,
    ":base: bg-gradient-to-tr bg-[length:125%_auto] text-white outline-tertiary @hover:bg-right focus-visible:bg-right"
  ),
  secondary: clsx(
    outlinedClasses,
    ":base: bg-white outline-gray-200 shadow-gray-200 @hover:bg-gray-100 focus-visible:bg-gray-100"
  ),
  ghost: ":base: bg-transparent focus:outline-none @hover:bg-gray-200 focus-visible:bg-gray-200"
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

const Button: ParentComponent<ButtonProps> = (providedProps) => {
  const props = mergeProps({ variant: "primary", size: "small" } as const, providedProps);
  const [local, rest] = splitProps(props, ["class", "variant", "size", "text", "link", "badge"]);
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
        local.text && local.variant !== "primary" && textClasses[local.text],
        local.class
      )}
    />
  );
};
const IconButton: ParentComponent<IconButtonProps> = (providedProps) => {
  const props = mergeProps({ variant: "secondary", size: "small" } as const, providedProps);
  const [local, rest] = splitProps(props, ["class", "icon", "label", "iconClass", "children"]);
  const text = () => props.text ?? (props.variant === "primary" ? undefined : "soft");

  return (
    <Button {...rest} text={text()} class={clsx(iconButtonSizes[props.size].button, local.class)}>
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
