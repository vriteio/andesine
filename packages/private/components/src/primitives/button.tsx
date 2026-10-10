import { Spinner } from "./spinner";
import clsx from "clsx";
import {
  type Component,
  type ComponentProps,
  type JSX,
  mergeProps,
  Show,
  splitProps,
  createMemo
} from "solid-js";
import { Dynamic } from "solid-js/web";

interface ButtonElementProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  target?: string;
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "link" | "danger";
type ButtonSize = "xs" | "small" | "medium";
type ButtonText = "base" | "soft" | "softer";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  class?: string;
  /** A non-interactive button look, without hover. */
  badge?: boolean;
  /** False for buttons with their own highlight, e.g. menu items. */
  hover?: boolean;
  link?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** The gray level of `secondary` and `ghost` buttons. */
  text?: ButtonText;
  loading?: boolean;
  target?: string;
}

interface IconButtonProps extends ButtonProps {
  icon?: string;
  iconProps?: ComponentProps<"div">;
  label?: string | Component;
}

// Explicit JSX supplies templates when these elements render after hydration.
const buttonElements = {
  button: (props: ButtonElementProps) => <button {...props} />,
  a: (props: ButtonElementProps) => (
    <a {...(props as JSX.AnchorHTMLAttributes<HTMLAnchorElement>)} />
  ),
  div: (props: ButtonElementProps) => <div {...(props as JSX.HTMLAttributes<HTMLDivElement>)} />
};

const baseClasses =
  ":base: transition-[background-position,opacity] relative ease-out duration-200 font-medium !ring-0 !focus:ring-0 disabled:opacity-70";
const outlinedClasses = ":base: outline outline-1 -outline-offset-1 shadow-md";
const flatClasses = ":base: bg-transparent !focus:outline-none !focus-visible:outline-none";
const gradientClasses = ":base: bg-gradient-to-tr from-secondary via-primary to-secondary";
const sizeClasses: Record<ButtonSize, string> = {
  xs: ":base: px-1 py-0.5 text-xs",
  small: ":base: px-1.5 py-1 text-sm",
  medium: ":base: px-2 py-1 text-base"
};
const iconButtonSizes = {
  xs: { button: ":base-2: p-1", icon: ":base: w-4.5 h-4.5", label: ":base: pl-1" },
  small: { button: ":base-2: p-1", icon: ":base: w-5 h-5", label: ":base: pl-1" },
  medium: { button: ":base-2: p-1", icon: ":base: w-6 h-6", label: ":base: pl-1" }
};
const variantClasses: Record<ButtonVariant, string> = {
  primary: clsx(
    outlinedClasses,
    gradientClasses,
    ":base: bg-[length:125%_auto] text-white outline-tertiary"
  ),
  secondary: clsx(outlinedClasses, ":base: bg-white outline-gray-200 shadow-gray-200"),
  ghost: flatClasses,
  link: clsx(flatClasses, gradientClasses, ":base: text-transparent bg-clip-text"),
  danger: clsx(outlinedClasses, ":base: bg-red-500 outline-red-600 text-white")
};
// Keyboard focus shows the hover style; links underline their content instead.
const hoverClasses: Record<ButtonVariant, string> = {
  primary:
    ":base: @hover:bg-right focus-visible:bg-right @hover:outline-tertiary focus-visible:outline-tertiary",
  secondary:
    ":base: @hover:bg-gray-50 focus-visible:bg-gray-50 @hover:outline-gray-200 focus-visible:outline-gray-200",
  ghost: ":base: @hover:bg-gray-200 focus-visible:bg-gray-200",
  link: "",
  danger:
    ":base: @hover:bg-red-600 focus-visible:bg-red-600 @hover:outline-red-700 focus-visible:outline-red-700"
};
const underlineClasses = clsx(
  ":base: after:absolute after:opacity-0 after:transition after:delay-50 after:duration-200 after:ease-out after:origin-left after:scale-x-0 after:w-full after:h-1px after:bottom-px after:left-0 after-rounded-lg after:content-[''] @hover:after:scale-100 focus-visible:after:scale-100 @hover:after:opacity-100 focus-visible:after:opacity-100",
  ":base: after:bg-gradient-to-tr after:from-secondary after:via-primary after:to-secondary"
);
const textClasses: Record<ButtonText, string> = {
  base: ":base: text-gray-700",
  softer: ":base: text-gray-500",
  soft: ":base: text-gray-400"
};
const isGray = (variant: ButtonVariant) => variant === "secondary" || variant === "ghost";

const Button: Component<ButtonProps> = (providedProps) => {
  const props = mergeProps(
    { variant: "primary", size: "small", hover: true } as const,
    providedProps
  );
  const [, passedProps] = splitProps(props, [
    "class",
    "hover",
    "loading",
    "disabled",
    "text",
    "variant",
    "size",
    "link",
    "badge",
    "children",
    "onClick",
    "tabIndex"
  ]);
  const component = createMemo(() => {
    if (props.link) return "a";
    if (props.badge) return "div";
    return "button";
  });
  const tabIndex = createMemo(() => {
    if (component() === "a" && (props.disabled || props.loading)) return -1;
    if (typeof props.tabIndex !== "undefined") return props.tabIndex;
    return undefined;
  });
  const disabled = createMemo(() => Boolean(props.disabled || props.loading));
  const disabledLink = createMemo(() => component() === "a" && disabled());
  const hovers = () => props.hover && !props.badge;

  return (
    <Dynamic
      component={buttonElements[component()]}
      {...passedProps}
      class={clsx(
        baseClasses,
        sizeClasses[props.size],
        !props.badge && ":base: cursor-pointer",
        variantClasses[props.variant],
        props.text && isGray(props.variant) && textClasses[props.text],
        hovers() && hoverClasses[props.variant],
        disabledLink() && ":base: opacity-70 pointer-events-none",
        props.variant !== "link" && ":base: rounded-lg",
        props.class
      )}
      disabled={component() === "button" ? disabled() : undefined}
      aria-disabled={disabledLink() || undefined}
      tabIndex={tabIndex()}
      href={disabledLink() ? undefined : props.link}
      onClick={
        disabledLink()
          ? (event: MouseEvent) => {
              event.preventDefault();
              event.stopImmediatePropagation();
            }
          : props.onClick
      }
    >
      <div
        class={clsx(
          "contents",
          props.loading && "invisible",
          hovers() && props.variant === "link" && underlineClasses
        )}
      >
        {props.children}
      </div>
      <Show when={props.loading}>
        <div class="flex justify-center items-center absolute w-full h-full p-1.5 top-0 left-0">
          <Spinner class={clsx("h-full", props.variant === "link" && gradientClasses)} />
        </div>
      </Show>
    </Dynamic>
  );
};

const IconButton: Component<IconButtonProps> = (providedProps) => {
  const props = mergeProps({ variant: "secondary", size: "small" } as const, providedProps);
  const [, passedProps] = splitProps(props, ["icon", "iconProps", "label", "text"]);
  // Icons of gray buttons are soft unless set otherwise.
  const text = () => props.text ?? (isGray(props.variant) ? "soft" : undefined);

  return (
    <Button
      {...passedProps}
      text={text()}
      class={clsx(
        ":base-2: flex items-center justify-center",
        iconButtonSizes[props.size].button,
        props.class
      )}
    >
      <div
        {...props.iconProps}
        class={clsx(
          iconButtonSizes[props.size].icon,
          props.variant === "link" && gradientClasses,
          props.icon,
          props.iconProps?.class
        )}
      >
        {props.children}
      </div>
      <Show when={typeof props.label === "function"}>
        <Dynamic component={props.label} />
      </Show>
      <Show when={typeof props.label === "string"}>
        <span class={iconButtonSizes[props.size].label}>{`${props.label}`}</span>
      </Show>
    </Button>
  );
};

export type { ButtonProps, ButtonSize, ButtonText, ButtonVariant, IconButtonProps };
export { Button, IconButton };
