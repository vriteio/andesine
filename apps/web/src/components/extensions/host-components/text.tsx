import { getExtensionHostActions, isDeclaredURL } from "#web/lib/extensions";
import clsx from "clsx";
import { Dynamic } from "solid-js/web";
import { type HostComponents, toneClasses } from "./types";

const textSizeClasses = { xs: "text-xs", sm: "text-sm", base: "text-base", lg: "text-lg" };
const textWeightClasses = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold"
};
const headingTags = { 1: "h2", 2: "h3", 3: "h4" };
const headingClasses = { 1: "text-lg", 2: "text-base", 3: "text-sm" };
const badgeClasses = {
  base: "bg-gray-200 text-gray-600",
  primary: "bg-gradient-to-tr text-white",
  danger: "bg-red-500 text-white",
  success: "bg-green-500 text-white"
};
const iconSizeClasses = { small: "h-4 w-4", medium: "h-5 w-5", large: "h-6 w-6" };
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
      class={clsx("font-semibold", headingClasses[props.props.level ?? 2], props.props.class)}
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
  Badge: (props) => (
    <span
      class={clsx(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
        badgeClasses[props.props.color ?? "base"]
      )}
    >
      {props.children}
    </span>
  ),
  // Icon classes come from the extension's generated CSS.
  Icon: (props) => (
    <div
      aria-hidden="true"
      class={clsx(
        "shrink-0",
        props.props.name,
        iconSizeClasses[props.props.size ?? "medium"],
        toneClasses[props.props.tone ?? "default"]
      )}
    />
  )
};

export { textComponents };
