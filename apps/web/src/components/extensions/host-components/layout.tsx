import { ScrollArea } from "@andesine/components";
import clsx from "clsx";
import { type HostComponents, gapClasses } from "./types";

const alignClasses = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch"
};
const justifyClasses = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between"
};
const columnClasses = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4"
};
const paddingClasses = { none: "p-0", small: "p-1", medium: "p-2", large: "p-4" };
const backgroundClasses = { none: "", soft: "bg-gray-100", contrast: "bg-gray-50" };
const maxHeightClasses = { small: "max-h-40", medium: "max-h-64", large: "max-h-96" };
const layoutComponents: Pick<HostComponents, "Stack" | "Grid" | "Box" | "Divider" | "ScrollArea"> =
  {
    Stack: (props) => (
      <div
        class={clsx(
          "flex min-w-0",
          props.props.direction === "row" ? "flex-row" : "flex-col",
          gapClasses[props.props.gap ?? "medium"],
          props.props.align && alignClasses[props.props.align],
          props.props.justify && justifyClasses[props.props.justify],
          props.props.wrap && "flex-wrap",
          props.props.class
        )}
      >
        {props.children}
      </div>
    ),
    Grid: (props) => (
      <div
        class={clsx(
          "grid min-w-0",
          columnClasses[(props.props.columns ?? 2) as keyof typeof columnClasses],
          gapClasses[props.props.gap ?? "medium"],
          props.props.class
        )}
      >
        {props.children}
      </div>
    ),
    Box: (props) => (
      <div
        class={clsx(
          "min-w-0 rounded-lg",
          paddingClasses[props.props.padding ?? "medium"],
          backgroundClasses[props.props.background ?? "none"],
          props.props.border && "border border-gray-200",
          props.props.class
        )}
      >
        {props.children}
      </div>
    ),
    Divider: () => <div role="separator" class="h-px w-full shrink-0 bg-gray-200" />,
    ScrollArea: (props) => (
      <ScrollArea viewportClass={maxHeightClasses[props.props.maxHeight ?? "medium"]}>
        {props.children}
      </ScrollArea>
    )
  };

export { layoutComponents };
