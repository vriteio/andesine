import { getMaskStyle } from "@andesine/components";
import { getExtensionHostActions, isDeclaredURL } from "#web/lib/extensions";
import { loadIconMask } from "#web/lib/extensions/icon-masks";
import clsx from "clsx";
import { createEffect, createSignal, on, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { type HostComponents, iconToneClasses, toneClasses } from "./types";

const textSizeClasses = {
  xs: ":base: text-xs",
  sm: ":base: text-sm",
  base: ":base: text-base",
  lg: ":base: text-lg"
};
const textWeightClasses = {
  normal: ":base: font-normal",
  medium: ":base: font-medium",
  semibold: ":base: font-semibold"
};
const headingTags = { 1: "h2", 2: "h3", 3: "h4" };
const headingClasses = { 1: ":base: text-lg", 2: ":base: text-base", 3: ":base: text-sm" };
const iconSizeClasses = {
  small: ":base: h-4 w-4",
  medium: ":base: h-5 w-5",
  large: ":base: h-6 w-6"
};
/** Whether CSS draws the element's icon, e.g. the extension's for its own icon classes. */
const hasCSSIcon = (element: Element) => {
  const style = getComputedStyle(element);
  const images = [
    style.getPropertyValue("mask-image"),
    style.getPropertyValue("-webkit-mask-image"),
    style.backgroundImage
  ];

  // `url(…)`, not a gradient, e.g. of a `bg-gradient-to-tr` class on a masked icon.
  return images.some((image) => image.startsWith("url("));
};
const textComponents: Pick<
  HostComponents,
  "Text" | "Heading" | "Code" | "Link" | "Badge" | "Icon"
> = {
  Text: (props) => (
    <span
      class={clsx(
        textSizeClasses[props.props.size ?? "sm"],
        textWeightClasses[props.props.weight ?? "normal"],
        toneClasses[props.props.tone ?? "default"],
        props.props.class
      )}
    >
      {props.children}
    </span>
  ),
  Heading: (props) => (
    <Dynamic
      component={headingTags[props.props.level ?? 2]}
      class={clsx(
        ":base: font-semibold",
        headingClasses[props.props.level ?? 2],
        props.props.class
      )}
    >
      {props.children}
    </Dynamic>
  ),
  Code: (props) => (
    <code class="rounded-md bg-gray-100 px-1 font-mono text-[85%]">{props.children}</code>
  ),
  // Undeclared links have no `href`, so no click or menu bypasses the member's confirmation.
  Link: (props) => {
    const isDeclared = () => isDeclaredURL(props.props.href, props.sources);
    const confirm = () => {
      void getExtensionHostActions()?.openURL(props.props.href, false, props.extension);
    };

    return (
      <a
        href={isDeclared() ? props.props.href : undefined}
        role="link"
        tabIndex={0}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        class="cursor-pointer underline decoration-gray-400 underline-offset-2 hover:decoration-current"
        onClick={() => {
          if (!isDeclared()) confirm();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !isDeclared()) confirm();
        }}
      >
        {props.children}
      </a>
    );
  },
  // As the app's webhook delivery badges: white and outlined; the tone is only the icon's.
  Badge: (props) => (
    <span class="inline-flex h-6 max-w-full items-center gap-1 rounded-lg bg-white px-1.5 text-sm text-gray-500 shadow-md shadow-gray-900/8 outline outline-1 -outline-offset-1 outline-gray-200">
      <Show when={props.props.icon}>
        {(icon) => (
          <span
            class={clsx("h-4 w-4 shrink-0", icon(), iconToneClasses[props.props.tone ?? "muted"])}
          />
        )}
      </Show>
      <span class="truncate">{props.children}</span>
    </span>
  ),
  // Icon classes come from the extension's generated CSS.
  Icon: (props) => {
    const [mask, setMask] = createSignal<string | null>(null);

    let element: HTMLDivElement | undefined;

    // Icons from documents, e.g. a card's, aren't in the extension's CSS; a mask draws them. Its
    // set loads only then, once the class's own icon is known to be missing.
    createEffect(
      on(
        () => props.props.name,
        (name) => {
          setMask(null);
          requestAnimationFrame(() => {
            if (name !== props.props.name || !element || hasCSSIcon(element)) return;

            void loadIconMask(name).then((value) => name === props.props.name && setMask(value));
          });
        }
      )
    );

    return (
      <div
        ref={element}
        aria-hidden="true"
        class={clsx(
          "shrink-0",
          props.props.name,
          iconSizeClasses[props.props.size ?? "medium"],
          toneClasses[props.props.tone ?? "default"],
          props.props.class
        )}
        style={mask() ? getMaskStyle(mask()!) : undefined}
      />
    );
  }
};

export { textComponents };
