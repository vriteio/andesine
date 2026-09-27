import type { IconLinkConfig, NavigationItem, SectionContext } from "@andesine/pages";
import { createScrollMemory } from "@andesine/ui/solid";
import clsx from "clsx";
import { type Component, Show } from "solid-js";

import { ScrollArea } from "../primitives/scroll-area";
import { NavigationLinks } from "./navigation-links";
import { NavigationTree } from "./navigation-tree";
import { PoweredBy } from "./powered-by";

interface SidebarProps {
  navigation: NavigationItem[];
  /** Sections to show above the navigation, in place of header tabs. */
  sections: SectionContext[];
  links: IconLinkConfig[];
  storageKey: string;
  class?: string;
}

const Sidebar: Component<SidebarProps> = (props) => {
  let viewport: HTMLDivElement | undefined;

  createScrollMemory({
    container: () => viewport,
    key: `${props.storageKey}:scroll`,
    current: () => viewport?.querySelector<HTMLElement>("[aria-current='page']")
  });

  return (
    <div class={props.class}>
      <ScrollArea
        shadow
        class="h-full"
        viewportRef={(element) => (viewport = element)}
        contentClass="flex min-h-full flex-col px-3 pt-4"
      >
        <Show when={props.sections.length || props.links.length}>
          <NavigationLinks sections={props.sections} links={props.links} class="px-2 pb-4" />
        </Show>
        <NavigationTree
          items={props.navigation}
          storageKey={props.storageKey}
          defaultDepth={2}
          class="flex-1 pb-4"
        />
        {/* After the navigation, and at the bottom while the navigation scrolls. It covers the
            bottom scroll shadow, so its fade stands in for it. */}
        <div
          class={clsx(
            "sticky bottom-0 z-2 bg-gray-50 px-2 py-4",
            "before:(pointer-events-none absolute inset-x-0 -top-12 h-12 bg-gradient-to-t from-gray-50 to-gray-50/0 opacity-0 transition-opacity duration-150 content-[''])",
            "[[data-part=viewport][data-overflow-y]:not([data-at-bottom])_&]:before:opacity-100"
          )}
        >
          <PoweredBy />
        </div>
      </ScrollArea>
    </div>
  );
};

export { Sidebar };
