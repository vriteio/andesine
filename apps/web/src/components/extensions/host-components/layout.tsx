import { Button, IconButton, ScrollArea, Tooltip } from "@andesine/components";
import clsx from "clsx";
import { SettingsSection } from "#web/pages/workspace/settings/settings-section";
import { type HostComponents, gapClasses } from "./types";

const alignClasses = {
  start: ":base: items-start",
  center: ":base: items-center",
  end: ":base: items-end",
  stretch: ":base: items-stretch"
};
const justifyClasses = {
  start: ":base: justify-start",
  center: ":base: justify-center",
  end: ":base: justify-end",
  between: ":base: justify-between"
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
const layoutComponents: Pick<
  HostComponents,
  "Stack" | "Grid" | "Box" | "Divider" | "ScrollArea" | "Section" | "SaveBar"
> = {
  Section: (props) => <SettingsSection label={props.props.title}>{props.children}</SettingsSection>,
  // As the footer of the app's settings forms, e.g. the API key page: a line, then the actions.
  SaveBar: (props) => (
    <>
      <div class="flex h-4 w-full items-center justify-center">
        <div class="h-px flex-1 bg-gray-200" />
      </div>
      <div class="flex items-center justify-end gap-2">
        <Tooltip content="Discard changes">
          <IconButton
            icon="i-lucide:undo-2"
            disabled={!props.props.dirty || props.props.saving}
            onClick={() => props.emit("onDiscard")}
          />
        </Tooltip>
        <Tooltip
          content={props.props.message}
          enabled={Boolean(props.props.message)}
          wrapperClass="flex-1"
        >
          <Button
            variant="primary"
            class="w-full justify-center"
            disabled={!props.props.dirty}
            loading={props.props.saving}
            onClick={() => props.emit("onSave")}
          >
            {props.props.saveLabel ?? "Save changes"}
          </Button>
        </Tooltip>
      </div>
    </>
  ),
  Stack: (props) => (
    <div
      class={clsx(
        ":base: flex min-w-0",
        props.props.direction === "row" ? ":base: flex-row" : ":base: flex-col",
        gapClasses[props.props.gap ?? "medium"],
        props.props.align && alignClasses[props.props.align],
        props.props.justify && justifyClasses[props.props.justify],
        props.props.wrap && ":base: flex-wrap",
        props.props.class
      )}
    >
      {props.children}
    </div>
  ),
  Grid: (props) => (
    <div
      class={clsx(
        ":base: grid min-w-0",
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
        // A low layer, so the view's classes win, e.g. other corners.
        ":base: min-w-0 rounded-lg",
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
