import { Popover as ArkPopover } from "@ark-ui/solid/popover";
import clsx from "clsx";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  Index,
  type JSX,
  Show
} from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import { ScrollShadow } from "../fragments/scroll-shadow";
import { createRef } from "../ref";
import { Button, IconButton } from "./button";
import { Card } from "./card";
import { Fragment } from "./fragment";
import { Input } from "./input";
import { Tooltip } from "./tooltip";

interface IconPickerSet {
  /** The Iconify prefix, e.g. `lucide`. */
  prefix: string;
  label: string;
}
interface IconPickerIcons {
  /** The icons' names, e.g. `settings`. */
  names: string[];
  /** An icon's CSS mask image, e.g. an SVG data URL; null for an unknown icon. */
  getMask(name: string): string | null;
}
interface IconPickerMatch {
  prefix: string;
  name: string;
  /** The set's label, e.g. to tell apart icons with one name in two sets. */
  setLabel: string;
}
interface MaskIconProps {
  mask: string | null;
  class?: string;
}
interface IconPickerProps {
  /** An icon class, e.g. `i-lucide:settings`. */
  value?: string;
  /** The sets listed together, in this order. */
  sets: IconPickerSet[];
  /** The icons of a set; loaded when the dropdown opens, so closed pickers load only their icon's. */
  loadSet(prefix: string): Promise<IconPickerIcons | null>;
  placeholder?: string;
  disabled?: boolean;
  /** A button that removes the icon, e.g. for an optional one. */
  clearable?: boolean;
  /** A square button with only the icon, e.g. before a field in a row. */
  compact?: boolean;
  portal?: boolean;
  positioningStrategy?: "absolute" | "fixed";
  /** Where the dropdown opens, with its top or left edge on the button's; below by default. */
  placement?: "bottom" | "right";
  triggerClass?: string;
  setValue?(value: string): void;
}

const ICON_CLASS = /^i-([a-z\d-]+):([a-z\d-]+)$/;
// A grid of every icon in a large set is slow to draw; a search finds the others.
const MAX_ICONS = 160;

const parseIcon = (value?: string) => {
  const [, prefix = "", name = ""] = ICON_CLASS.exec(value ?? "") ?? [];

  return { prefix, name };
};
/** Draws an icon from its CSS mask image in the current text color. */
const getMaskStyle = (mask: string): JSX.CSSProperties => {
  return {
    "-webkit-mask": `${mask} no-repeat center / 100% 100%`,
    "mask": `${mask} no-repeat center / 100% 100%`,
    "background-color": "currentColor"
  };
};
const MaskIcon: Component<MaskIconProps> = (props) => (
  <span
    aria-hidden="true"
    class={clsx(":base: shrink-0", props.class)}
    style={props.mask ? getMaskStyle(props.mask) : undefined}
  />
);
/** A button with the icon and its name, and a dropdown that searches the icons of each set. */
const IconPicker: Component<IconPickerProps> = (props) => {
  const [opened, setOpened] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [gridRef, setGridRef] = createRef<HTMLElement | null>(null);
  // Loaded sets by prefix; a plain signal, not a resource, so loading doesn't suspend the page.
  const [loadedSets, setLoadedSets] = createSignal<Record<string, IconPickerIcons | null>>({});
  const selected = createMemo(() => parseIcon(props.value));
  const loading = () => props.sets.some(({ prefix }) => !(prefix in loadedSets()));
  // The loaded sets' icons in one list, in the sets' order; only the first ones are drawn.
  const matches = createMemo(() => {
    const search = query().trim().toLowerCase().replace(/\s+/g, "-");
    const icons: IconPickerMatch[] = [];

    let total = 0;

    for (const { prefix, label } of props.sets) {
      for (const name of loadedSets()[prefix]?.names ?? []) {
        if (search && !name.includes(search)) continue;
        if (icons.length < MAX_ICONS) icons.push({ prefix, name, setLabel: label });

        total += 1;
      }
    }

    return { icons, total };
  });
  const loadSet = (prefix: string) => {
    if (!prefix || prefix in loadedSets()) return;

    void props.loadSet(prefix).then((loaded) => {
      setLoadedSets((current) => ({ ...current, [prefix]: loaded }));
    });
  };
  const choose = (icon: IconPickerMatch) => {
    props.setValue?.(`i-${icon.prefix}:${icon.name}`);
    setOpened(false);
  };
  const handleOpenedChange = (nextOpened: boolean) => {
    if (!nextOpened) setQuery("");

    setOpened(nextOpened);
  };

  createEffect(() => loadSet(selected().prefix));
  createEffect(() => {
    if (opened()) props.sets.forEach(({ prefix }) => loadSet(prefix));
  });

  return (
    <ArkPopover.Root
      open={opened()}
      positioning={{
        placement: `${props.placement ?? "bottom"}-start`,
        offset: { mainAxis: props.placement === "right" ? 6 : 4 },
        strategy: props.positioningStrategy
      }}
      onOpenChange={(details) => handleOpenedChange(details.open)}
      lazyMount
      unmountOnExit
    >
      {/* A compact button has no text, so a tooltip says what it does. */}
      <Dynamic component={props.compact ? Tooltip : Fragment} content="Pick icon">
        <ArkPopover.Trigger
          asChild={(triggerProps) => (
            <Button
              {...triggerProps()}
              type="button"
              class={clsx(
                props.compact
                  ? ":base-2: flex h-7 w-7 items-center justify-center p-0"
                  : ":base-2: flex w-full min-w-0 items-center justify-start gap-2 py-1 px-1.5",
                props.triggerClass
              )}
              variant="secondary"
              disabled={props.disabled}
              aria-label={
                props.compact ? selected().name || props.placeholder || "Select icon" : undefined
              }
            >
              <Show
                when={props.value}
                fallback={<span class=":base: i-lucide:shapes h-4 w-4 shrink-0 text-gray-400" />}
              >
                <MaskIcon
                  mask={loadedSets()[selected().prefix]?.getMask(selected().name) ?? null}
                  class=":base: h-4 w-4 text-gray-700"
                />
              </Show>
              <Show when={!props.compact}>
                <span
                  class={clsx(
                    ":base: min-w-0 flex-1 truncate text-start text-sm",
                    !props.value && ":base: text-gray-400"
                  )}
                >
                  {props.value ? selected().name : props.placeholder || "Select icon"}
                </span>
                <span class=":base: i-lucide:chevrons-up-down ml-auto shrink-0 text-gray-400" />
              </Show>
            </Button>
          )}
        />
      </Dynamic>
      <Dynamic component={props.portal === false ? Fragment : Portal}>
        <ArkPopover.Positioner class=":base: z-50">
          <ArkPopover.Content
            asChild={(contentProps) => (
              <Card
                {...contentProps()}
                shade
                class=":base-2: z-50 m-0 rounded-[0.625rem] bg-white p-0 pointer-events-auto"
                style={{ "transform-origin": "var(--transform-origin)" }}
              >
                <div class=":base: flex w-max max-w-full flex-col gap-2 p-2">
                  <div class=":base: flex items-center gap-1">
                    <Input
                      ref={(input) => {
                        requestAnimationFrame(() => {
                          if (opened()) input.focus();
                        });
                      }}
                      class=":base-2: w-full min-w-0 rounded-md bg-gray-50"
                      placeholder="Search icons"
                      value={query()}
                      setValue={setQuery}
                      onKeyDown={(event) => event.stopPropagation()}
                      onEnter={(event) => event.preventDefault()}
                    />
                    <Show when={props.clearable && props.value}>
                      <Tooltip content="Remove icon">
                        <IconButton
                          type="button"
                          variant="secondary"
                          icon="i-lucide:x"
                          class=":base-2: rounded-md"
                          aria-label="Remove icon"
                          onClick={() => {
                            props.setValue?.("");
                            setOpened(false);
                          }}
                        />
                      </Tooltip>
                    </Show>
                  </div>
                  <div class=":base: relative flex min-h-0 flex-col">
                    <ScrollShadow color="white" scrollableContainerRef={gridRef} />
                    <div
                      ref={setGridRef}
                      class=":base: grid max-h-56 grid-cols-[repeat(7,1.75rem)] content-start gap-1 overflow-y-auto scrollbar-sm scrollbar-white"
                    >
                      {/* By position, so a search reuses the buttons in place of making new ones. */}
                      <Index
                        each={matches().icons}
                        fallback={
                          <span class=":base: col-span-7 px-1 py-2 text-sm text-gray-400">
                            {loading() ? "Loading icons..." : "No icons found"}
                          </span>
                        }
                      >
                        {(icon) => {
                          const isSelected = () => {
                            return (
                              selected().prefix === icon().prefix && selected().name === icon().name
                            );
                          };

                          return (
                            <Button
                              type="button"
                              variant={isSelected() ? "primary" : "ghost"}
                              size="xs"
                              title={`${icon().name} (${icon().setLabel})`}
                              aria-label={`${icon().name} (${icon().setLabel})`}
                              class=":base-2: flex aspect-square items-center justify-center p-0"
                              onPointerDown={(event) => event.preventDefault()}
                              onClick={() => choose(icon())}
                            >
                              <MaskIcon
                                mask={loadedSets()[icon().prefix]?.getMask(icon().name) ?? null}
                                class={clsx(
                                  ":base: h-5 w-5",
                                  !isSelected() && ":base: text-gray-700"
                                )}
                              />
                            </Button>
                          );
                        }}
                      </Index>
                      <Show when={matches().total > MAX_ICONS}>
                        <span class=":base: col-span-7 px-1 py-2 text-xs text-gray-400">
                          {MAX_ICONS} of {matches().total} icons. Search to find others.
                        </span>
                      </Show>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          />
        </ArkPopover.Positioner>
      </Dynamic>
    </ArkPopover.Root>
  );
};

export { IconPicker, MaskIcon, getMaskStyle, parseIcon };
export type { IconPickerIcons, IconPickerSet };
