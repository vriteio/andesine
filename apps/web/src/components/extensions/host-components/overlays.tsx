import {
  Dialog,
  DropdownArea,
  DropdownMenu,
  IconButton,
  type MenuItem,
  Spinner
} from "@andesine/components";
import clsx from "clsx";
import { createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { type ExtensionTreeNode } from "#web/lib/extensions";
import { useBlockAction } from "../block-action-context";
import { type HostComponentProps, type HostComponents } from "./types";

interface ExtensionContentProps {
  extension: string;
  children?: JSX.Element;
}

type MenuEntry = MenuItem | (() => JSX.Element);
type MenuItemNodeProps = HostComponentProps<"MenuItem">["props"];

// `small` matches the block menu.
const menuWidths = { small: "w-48", medium: "w-64" };

// Portaled content leaves the view's container, so it needs the extension's CSS scope again.
const ExtensionContent = (props: ExtensionContentProps) => (
  <div data-extension={props.extension} class="isolate min-w-0 [contain:layout_paint]">
    {props.children}
  </div>
);
// Whether the component is a block action's UI: at the root of its view.
const isActionRoot = (props: HostComponentProps<"Dialog" | "Menu">): boolean => {
  const parent = props.getNode(props.id)?.parent;

  return Boolean(useBlockAction()) && props.getNode(parent ?? -1)?.component === "#root";
};
/** `MenuItem`, `MenuGroup`, `MenuSeparator`, and `MenuContent` nodes as dropdown menu groups. */
const toMenuGroups = (
  props: HostComponentProps<"Menu">,
  ids: number[],
  onChoose: () => void
): Array<Array<MenuEntry>> => {
  const groups: Array<Array<MenuEntry>> = [[]];
  const toItem = (node: ExtensionTreeNode): MenuItem => {
    const item = node.props as MenuItemNodeProps;
    const submenu = toMenuGroups(props, node.children, onChoose);

    return {
      label: item.label,
      icon: item.loading
        ? () => <Spinner class="h-full w-full" />
        : item.icon && (() => <span class={clsx("block h-full w-full", item.icon)} />),
      shortcut: item.shortcut,
      color: item.color,
      selected: item.selected,
      disabled: item.disabled || item.loading,
      closeOnSelect: item.closeOnSelect,
      ...(submenu.length
        ? { items: submenu.length === 1 ? submenu[0] : submenu }
        : {
            onClick: () => {
              if (item.closeOnSelect !== false) onChoose();

              props.emitNode(node.id, "onSelect");
            }
          })
    };
  };

  for (const id of ids) {
    const node = props.getNode(id);
    const group = groups[groups.length - 1];

    if (node?.component === "MenuItem") {
      group.push(toItem(node));
    } else if (node?.component === "MenuContent") {
      group.push(() => (
        <ExtensionContent extension={props.extension}>
          <For each={node.children}>{(child) => props.renderNode(child)}</For>
        </ExtensionContent>
      ));
    } else if (node?.component === "MenuSeparator") {
      groups.push([]);
    } else if (node?.component === "MenuGroup") {
      const label = (node.props as HostComponentProps<"MenuGroup">["props"]).label;

      groups.push(
        [
          ...(label ? [{ label, type: "header" as const }] : []),
          ...toMenuGroups(props, node.children, onChoose).flat()
        ],
        []
      );
    }
  }

  return groups.filter((group) => group.length);
};
const overlayComponents: Pick<
  HostComponents,
  "Dialog" | "Menu" | "MenuTrigger" | "MenuItem" | "MenuGroup" | "MenuSeparator" | "MenuContent"
> = {
  Dialog: (props) => {
    const action = useBlockAction();
    const actionRoot = isActionRoot(props);
    // Outside block actions, only right after an interaction: extensions can't open modals alone.
    const allowed = Boolean(action) || props.hasRecentInteraction();
    const dismissible = () => props.props.dismissible !== false;
    const dismiss = () => {
      if (!dismissible()) return;

      props.emit("onClose");
      if (actionRoot) action?.close();
    };

    return (
      <Show when={allowed}>
        <Dialog
          opened
          size={props.props.size ?? "medium"}
          closeOnEscape={dismissible()}
          onOverlayClick={dismiss}
          aria-label={props.props.title}
        >
          <div class="flex items-start gap-2">
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <h3 class="text-lg font-semibold leading-tight">{props.props.title}</h3>
              <Show when={props.props.description}>
                <p class="text-sm text-gray-500">{props.props.description}</p>
              </Show>
            </div>
            <Show when={dismissible()}>
              <IconButton icon="i-lucide:x" variant="ghost" aria-label="Close" onClick={dismiss} />
            </Show>
          </div>
          <ExtensionContent extension={props.extension}>{props.children}</ExtensionContent>
        </Dialog>
      </Show>
    );
  },
  Menu: (props) => {
    const action = useBlockAction();
    const actionRoot = isActionRoot(props);
    const origin = actionRoot ? action?.origin : undefined;
    // A block action's menu opens right away, in the block menu's place.
    const [uncontrolledOpened, setUncontrolledOpened] = createSignal(actionRoot);

    let chosen = false;

    const opened = () => props.props.opened ?? uncontrolledOpened();
    const items = () => {
      return toMenuGroups(props, props.getNode(props.id)?.children ?? [], () => (chosen = true));
    };
    const triggerNode = () => {
      return props.childNodes().find(({ component }) => component === "MenuTrigger");
    };
    const cardProps = () => ({
      "data-extension": props.extension,
      "class": menuWidths[props.props.size ?? "small"]
    });
    // The dropdown reports its state on every change, including its initial one.
    const setOpened = (next: boolean) => {
      if (next === opened()) return;

      setUncontrolledOpened(next);
      props.emit("onOpenChange", next);

      // A choice closes the menu, but its `onSelect` still has to run.
      if (!next && actionRoot) {
        if (chosen) action?.continueWithoutUI();
        else action?.close();
      }

      chosen = false;
    };
    const renderTrigger = () => (
      <For each={triggerNode()?.children ?? []}>{(id) => props.renderNode(id)}</For>
    );
    const menu = (menuProps: Partial<Parameters<typeof DropdownMenu>[0]> = {}) => (
      <DropdownMenu
        title={props.props.title}
        placement={props.props.placement ?? "bottom-start"}
        opened={opened()}
        setOpened={setOpened}
        cardProps={cardProps()}
        items={items()}
        {...menuProps}
      />
    );
    const blocksRect = action?.getBlocksRect();

    if (origin) {
      const layer = origin.container.getBoundingClientRect();

      // The block menu's trigger stays, as while the block menu is open.
      onCleanup(origin.holdTrigger());

      // In the editor's menu layer, so it scrolls with the content. A trigger in the place of the
      // block menu's anchor, with its placement, opens it in the block menu's place.
      return (
        <Portal mount={origin.container}>
          <div
            class="pointer-events-none absolute inset-0"
            style={{ "z-index": String(origin.zIndex) }}
          >
            {menu({
              portal: false,
              positioningStrategy: "absolute",
              placement: origin.placement,
              // At least the block menu's width; `size` can make it wider.
              cardProps: { ...cardProps(), style: { "min-width": `${origin.width}px` } },
              trigger: () => (
                <div
                  class="absolute"
                  style={{
                    left: `${origin.anchor.x - layer.left}px`,
                    top: `${origin.anchor.y - layer.top}px`,
                    width: `${origin.anchor.width}px`,
                    height: `${origin.anchor.height}px`
                  }}
                />
              )
            })}
          </div>
        </Portal>
      );
    }

    if (actionRoot) {
      // Narrow screens show a bottom sheet; otherwise it opens below the blocks.
      return menu({
        anchorPoint: blocksRect ? { x: blocksRect.left, y: blocksRect.bottom } : null
      });
    }

    if (props.props.contextMenu) {
      return (
        <DropdownArea>
          {renderTrigger()}
          {menu()}
        </DropdownArea>
      );
    }

    return menu({ trigger: () => <div class="inline-flex">{renderTrigger()}</div> });
  },
  // Rendered by their `Menu`.
  MenuTrigger: () => null,
  MenuItem: () => null,
  MenuGroup: () => null,
  MenuSeparator: () => null,
  MenuContent: () => null
};

export { overlayComponents };
