import type { NavigationItem } from "@andesine/pages";
import { NavigationTree as Tree } from "@andesine/ui/solid";
import clsx from "clsx";
import { type Component, For, Show } from "solid-js";

interface NavigationTreeProps {
  items: NavigationItem[];
  storageKey: string;
  /** Groups up to this depth start expanded. */
  defaultDepth?: number;
  class?: string;
}

interface BranchProps {
  items: NavigationItem[];
  depth: number;
}

interface ItemLinkProps {
  item: NavigationItem;
  depth: number;
  group?: boolean;
}

// Each nested list moves right by `ml-3.5` and `pl-px`.
const indent = (depth: number): string => `calc(${depth} * (0.875rem + 1px))`;
const rowClass =
  "relative isolate flex h-7.5 min-w-0 items-center rounded-lg px-2 transition duration-200 ease-out";
const hoverClass =
  "@hover:(bg-gradient-to-r from-gray-500/10 to-transparent) focus-visible:(bg-gradient-to-r from-gray-500/10 to-transparent)";

const ItemLink: Component<ItemLinkProps> = (props) => (
  <Tree.Link
    class={clsx(
      rowClass,
      "flex-1",
      props.depth > 0 && "rounded-l-none",
      props.group ? "text-sm font-semibold text-gray-700" : "text-base text-gray-500",
      !props.item.current && clsx(hoverClass, "@hover:text-gray-700 focus-visible:text-gray-700")
    )}
    style={{ "--indent": indent(props.depth) }}
    title={props.item.label}
  >
    <Show when={props.item.current}>
      {/* A named element, so page transitions move it from the old current item to the new one. */}
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-y-0 right-0 -z-1 rounded-lg bg-gradient-to-r from-secondary/10 via-primary/10 to-transparent [view-transition-name:navigation-highlight]"
        style={{ left: `calc(-1 * ${indent(props.depth)})` }}
      />
      <For each={Array.from({ length: props.depth }, (_, index) => index)}>
        {(index) => (
          <span
            aria-hidden="true"
            class="pointer-events-none absolute top-1/2 z-1 h-4 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b"
            style={{ left: `calc(-1.5px - ${indent(index)})` }}
          />
        )}
      </For>
    </Show>
    <span
      class={clsx(
        "truncate",
        props.item.current &&
          "bg-gradient-to-tr bg-[length:125%_auto] bg-clip-text text-transparent"
      )}
    >
      {props.item.label}
    </span>
  </Tree.Link>
);
const Chevron: Component = () => (
  <span
    aria-hidden="true"
    class="i-lucide:chevron-right h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 [[data-state=open]>&]:rotate-90"
  />
);
const Branch: Component<BranchProps> = (props) => (
  <Tree.List class="flex flex-col gap-0.5">
    <For each={props.items}>
      {(item) => (
        <Tree.Item item={item}>
          <Show when={item.children.length} fallback={<ItemLink item={item} depth={props.depth} />}>
            <div class="flex items-center">
              <Show
                when={item.href}
                fallback={
                  <Tree.GroupTrigger
                    class={clsx(
                      rowClass,
                      hoverClass,
                      "w-full cursor-pointer gap-2 text-sm font-semibold text-gray-700",
                      props.depth > 0 && "rounded-l-none"
                    )}
                  >
                    <span class="flex-1 truncate text-start">{item.label}</span>
                    <Chevron />
                  </Tree.GroupTrigger>
                }
              >
                <ItemLink item={item} depth={props.depth} group />
                <Tree.GroupTrigger
                  aria-label={`${item.label} pages`}
                  class={clsx(
                    "flex h-7.5 w-7.5 shrink-0 cursor-pointer items-center justify-center rounded-lg transition duration-200 ease-out",
                    "@hover:bg-gray-500/10 focus-visible:bg-gray-500/10"
                  )}
                >
                  <Chevron />
                </Tree.GroupTrigger>
              </Show>
            </div>
            <Tree.GroupContent class="relative ml-3.5 mt-0.5 pl-px before:(absolute inset-y-0 left-0 w-px rounded-full bg-gray-200 content-[''])">
              <Branch items={item.children} depth={props.depth + 1} />
            </Tree.GroupContent>
          </Show>
        </Tree.Item>
      )}
    </For>
  </Tree.List>
);
const NavigationTree: Component<NavigationTreeProps> = (props) => (
  <Tree.Root
    items={props.items}
    storageKey={props.storageKey}
    defaultDepth={props.defaultDepth}
    class={props.class}
  >
    <Branch items={props.items} depth={0} />
  </Tree.Root>
);

export { NavigationTree };
