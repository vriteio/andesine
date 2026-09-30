import { Tabs } from "@andesine/ui/solid";
import clsx from "clsx";
import { type Component, For, Show } from "solid-js";
import { CopyButton } from "./copy-button";

interface TabsProps {
  values: string[];
  syncKey?: string;
  variant?: "content" | "code";
  /** Rendered HTML of each tab panel. */
  panels: string[];
}

const triggerClasses = {
  content:
    "cursor-pointer rounded-md px-2 py-0.5 transition duration-200 ease-out @hover:text-gray-700 focus-visible:text-gray-700 data-[selected]:(bg-white text-gray-700 shadow-md outline outline-1 outline-gray-200)",
  // Matches the section tabs: gradient text for the current tab, a gray line on hover.
  code: clsx(
    "relative flex h-full cursor-pointer items-center px-1.5 font-mono transition duration-200 ease-out",
    "@hover:text-gray-700 focus-visible:text-gray-700",
    "after:(absolute inset-x-1.5 -bottom-px h-px bg-gray-400 opacity-0 transition-opacity duration-200 content-[''])",
    "@hover:after:opacity-100 focus-visible:after:opacity-100",
    "data-[selected]:(bg-gradient-to-tr bg-[length:125%_auto] bg-clip-text text-transparent! after:hidden)"
  )
};

/** Tabs in a card: a segmented control for content, or a code header with a copy button. */
const ContentTabs: Component<TabsProps> = (props) => {
  const variant = (): "content" | "code" => props.variant ?? "content";

  return (
    <Tabs.Root
      values={props.values}
      syncKey={props.syncKey}
      data-code-group={variant() === "code" || undefined}
      class="not-prose my-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_0_12px_0px] shadow-gray-200"
    >
      <div
        class={clsx(
          // The standard card header: 2.25rem high, with the bottom border.
          "flex h-9 items-center gap-2 border-b border-gray-200",
          variant() === "code" && "pl-1.5 pr-1"
        )}
      >
        <Tabs.List
          class={clsx(
            "relative flex min-w-0 overflow-x-auto text-gray-500",
            variant() === "code"
              ? "h-full flex-1 gap-1 text-xs"
              : "h-full w-full items-center gap-1 bg-gray-100 px-1 text-sm"
          )}
        >
          <For each={props.values}>
            {(value) => (
              <Tabs.Trigger value={value} class={clsx("shrink-0", triggerClasses[variant()])}>
                {value}
              </Tabs.Trigger>
            )}
          </For>
          <Show when={variant() === "code"}>
            {/* Centered on the header's bottom border, like the section tabs indicator. */}
            <Tabs.Indicator class="pointer-events-none -bottom-[1.5px] h-0.5 w-[var(--width)] rounded-full bg-gradient-to-r [--transition-duration:200ms] [--transition-timing-function:ease-out]" />
          </Show>
        </Tabs.List>
        <Show when={variant() === "code"}>
          <div class="ml-auto flex shrink-0 items-center">
            <CopyButton />
          </div>
        </Show>
      </div>
      <For each={props.values}>
        {(value, index) => (
          <Tabs.Content
            value={value}
            class={clsx(
              variant() === "content" &&
                "prose max-w-none px-4 py-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            )}
            innerHTML={props.panels[index()]}
          />
        )}
      </For>
    </Tabs.Root>
  );
};

export { ContentTabs };
