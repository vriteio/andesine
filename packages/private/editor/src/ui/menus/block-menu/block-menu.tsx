import { createCodeBlockMenuItems } from "./code-block";
import { createElementMenuItems } from "./element";
import { createImageMenuItems } from "./image";
import { isBlockSelection } from "#editor/extensions/block-selection";
import { DropdownMenu, IconButton, type MenuItem } from "@andesine/components";
import { debounce } from "@solid-primitives/scheduled";
import { type Editor, type EditorEvents } from "@tiptap/core";
import {
  createEffect,
  createSignal,
  onCleanup,
  untrack,
  type JSX,
  type ParentComponent
} from "solid-js";
import { useBlockMenuContext } from "./context";
import {
  getBlockControlAnchorRect,
  getBlockControlTargetAtY,
  getBlockSelectionTopTarget,
  getCachedElementRect,
  getEditorScrollContainer,
  isPointInBlockControlArea,
  isTargetInBlockSelection,
  registerSelectionControlHiding
} from "#editor/ui/block-control-targeting";
import type { BlockControlTarget, BlockControlRange } from "#editor/ui/block-control-targeting";
import {
  BLOCK_CONTROL_HIDE_DELAY,
  BLOCK_CONTROL_SIZE,
  EDITOR_MENU_Z_INDEX
} from "#editor/ui/constants";
import { isPositionInInheritedField } from "#editor/ui/block-utils";
import { createTableMenuItems } from "./table";
import { createTurnIntoMenuItem } from "./turn-into";
import { doesTableExtendPastContent } from "#editor/ui/views/table-view/scroll";

interface BlockMenuProps {
  menuID: string;
  notify(type: "success" | "error", text: string): void;
  editor: Editor | null;
  textMenuSelectionRange: BlockControlRange | null;
  anchorPoint: { x: number; y: number } | null;
  menuOpened: boolean;
  setMenuOpened(opened: boolean): void;
}

type BlockMenuItem = MenuItem | (() => JSX.Element);
type BlockMenuItems = NonNullable<MenuItem["items"]>;

const getMenuGroups = (items: BlockMenuItems): BlockMenuItem[][] => {
  if (items.every((item): item is BlockMenuItem[] => Array.isArray(item)))
    return items.filter((group) => group.length > 0);

  return items.length ? [items.flat()] : [];
};

const BlockMenu: ParentComponent<BlockMenuProps> = (props) => {
  const { handleCopy, handleDelete } = useBlockMenuContext();
  const [currentNodePos, setCurrentNodePos] = createSignal(-1);
  const [coords, setCoords] = createSignal({ top: -10000, left: -10000 });
  const [hoverAreaHeight, setHoverAreaHeight] = createSignal(0);
  const [triggerAvailable, setTriggerAvailable] = createSignal(false);
  const [contextMenuMode, setContextMenuMode] = createSignal(false);
  const [imageItems, setImageItems] = createSignal<BlockMenuItems>([]);
  const [codeItems, setCodeItems] = createSignal<BlockMenuItems>([]);
  const [elementItems, setElementItems] = createSignal<BlockMenuItems>([]);
  const [tableItems, setTableItems] = createSignal<BlockMenuItems>([]);
  const [turnIntoItems, setTurnIntoItems] = createSignal<BlockMenuItems>([]);
  const menuItems = (): BlockMenuItem[][] => {
    const tableActions = tableItems();

    const items: MenuItem[] = [
      {
        label: "Copy",
        icon: "i-lucide:copy",
        onClick: handleCopy,
        shortcut: "$mod+c"
      },

      {
        label: "Delete",
        icon: "i-lucide:trash",
        onClick: handleDelete,
        color: "danger",
        shortcut: "$mod+backspace"
      }
    ];

    if (tableActions.length > 0)
      return [...getMenuGroups(tableActions), ...getMenuGroups(elementItems()), items];

    if (imageItems().length)
      return [...getMenuGroups(imageItems()), ...getMenuGroups(elementItems()), items];

    return [
      ...getMenuGroups(codeItems()),
      ...getMenuGroups(turnIntoItems()),
      ...getMenuGroups(elementItems()),
      items
    ];
  };
  const handleOpenedChange = (opened: boolean) => {
    props.setMenuOpened(opened);

    if (!opened) {
      setTriggerAvailable(false);
    }
  };
  const getCurrentTarget = () => {
    const editor = props.editor;
    const pos = currentNodePos();

    if (!editor || pos < 0) return null;

    const node = editor.state.doc.nodeAt(pos);
    const dom = node ? editor.view.nodeDOM(pos) : null;

    return node && dom instanceof HTMLElement ? { dom, node, pos } : null;
  };
  const rangesOverlap = (target: BlockControlTarget, range: BlockControlRange): boolean => {
    return target.pos < range.to && target.pos + target.node.nodeSize > range.from;
  };
  const triggerVisible = () => {
    const target = getCurrentTarget();

    // Hide the trigger when the menu was opened via 'right click' or when there's a text menu opened within the block area
    if (
      !triggerAvailable() ||
      !props.editor ||
      !target ||
      isPositionInInheritedField(props.editor.state.doc, target.pos) ||
      (target.node.type.name === "table" && doesTableExtendPastContent(props.editor, target.dom))
    ) {
      return false;
    }
    if (contextMenuMode() && isTargetInBlockSelection(props.editor, target)) return false;
    if (props.textMenuSelectionRange && rangesOverlap(target, props.textMenuSelectionRange)) {
      return false;
    }

    return true;
  };

  createEffect(() => {
    const editor = props.editor;
    let codeMenuKey: string | undefined;

    const updateMenuItems = (event?: EditorEvents["transaction"]) => {
      if (event && !event.transaction.docChanged && !event.transaction.selectionSet) return;

      const selection = editor?.state.selection;
      const codeNode =
        selection?.$from.parent.type.name === "codeBlock"
          ? selection.$from.parent
          : selection && editor?.state.doc.nodeAt(selection.from);
      const nextCodeMenuKey =
        codeNode?.type.name === "codeBlock"
          ? `${codeNode.attrs.id}:${codeNode.attrs.language || ""}`
          : undefined;

      if (!untrack(() => props.menuOpened) || nextCodeMenuKey !== codeMenuKey) {
        setCodeItems(
          editor && !editor.isDestroyed ? createCodeBlockMenuItems(editor, props.notify) : []
        );
        codeMenuKey = nextCodeMenuKey;
      }
      setElementItems(editor && !editor.isDestroyed ? createElementMenuItems(editor) : []);
      setTableItems(editor && !editor.isDestroyed ? createTableMenuItems(editor) : []);
      setTurnIntoItems(editor && !editor.isDestroyed ? createTurnIntoMenuItem(editor) : []);
    };

    updateMenuItems();
    editor?.on("transaction", updateMenuItems);
    onCleanup(() => editor?.off("transaction", updateMenuItems));
  });

  createEffect(() => {
    const editor = props.editor;

    let imageMenuID: string | undefined;

    const updateMenuItems = (event?: EditorEvents["transaction"]) => {
      if (event && !event.transaction.docChanged && !event.transaction.selectionSet) return;

      const nextImageItems =
        editor && !editor.isDestroyed
          ? createImageMenuItems(editor, () => handleOpenedChange(false))
          : [];
      const nextImageID = editor?.state.doc.nodeAt(editor.state.selection.from)?.attrs.id;

      // Preserve input drafts while the menu is open on the same image.
      if (
        !untrack(() => props.menuOpened) ||
        nextImageID !== imageMenuID ||
        !nextImageItems.length
      ) {
        setImageItems(nextImageItems);
        imageMenuID = nextImageID;
      }
    };

    updateMenuItems();
    editor?.on("transaction", updateMenuItems);
    onCleanup(() => editor?.off("transaction", updateMenuItems));
  });

  createEffect(() => {
    const editor = props.editor;

    if (!editor) {
      setTriggerAvailable(false);
      return;
    }

    const hideTrigger = debounce(() => {
      if (!props.menuOpened) setTriggerAvailable(false);
    }, BLOCK_CONTROL_HIDE_DELAY);
    const updatePosition = (event: PointerEvent) => {
      if (props.menuOpened && !contextMenuMode()) return;

      try {
        const pointerTarget = getBlockControlTargetAtY(editor, event.clientY, {
          listItemSpecific: false
        });
        const selectionTarget = getBlockSelectionTopTarget(editor);
        const target =
          pointerTarget && selectionTarget && isTargetInBlockSelection(editor, pointerTarget)
            ? selectionTarget
            : pointerTarget;
        const tableExtendsPastContent = Boolean(
          target?.node.type.name === "table" && doesTableExtendPastContent(editor, target.dom)
        );

        // Only show the trigger when the pointer is over a block area
        if (
          !pointerTarget ||
          !target ||
          tableExtendsPastContent ||
          !isPointInBlockControlArea(editor, pointerTarget, {
            x: event.clientX,
            y: event.clientY,
            side: "right"
          })
        ) {
          hideTrigger();
          return;
        }

        const blockRect = getCachedElementRect(editor, target.dom);
        const referenceRect = getBlockControlAnchorRect(editor, target);
        const scrollContainer = getEditorScrollContainer(editor);

        if (!scrollContainer) {
          hideTrigger();
          return;
        }

        const scrollContainerRect = getCachedElementRect(editor, scrollContainer);
        const menuLeft =
          target.node.type.name === "codeBlock"
            ? Math.min(
                referenceRect.right + 8,
                scrollContainerRect.left + scrollContainer.clientWidth - BLOCK_CONTROL_SIZE - 4
              )
            : blockRect.right + 8;

        setCurrentNodePos(target.pos);
        setCoords({
          top:
            referenceRect.top -
            scrollContainerRect.top +
            scrollContainer.scrollTop +
            (referenceRect.height - BLOCK_CONTROL_SIZE) / 2,
          left: menuLeft - scrollContainerRect.left + scrollContainer.scrollLeft
        });
        setHoverAreaHeight(blockRect.height);
        hideTrigger.clear();
        setTriggerAvailable(true);
      } catch {
        hideTrigger();
      }
    };
    const handlePointerLeave = () => {
      // Opened dropdown forces the trigger to remain visible
      if (!props.menuOpened) {
        hideTrigger();
      }
    };
    const scrollContainer = getEditorScrollContainer(editor);
    const unregisterSelectionHandler = registerSelectionControlHiding(editor, () => {
      hideTrigger.clear();
      setTriggerAvailable(false);
    });

    scrollContainer?.addEventListener("pointermove", updatePosition);
    scrollContainer?.addEventListener("pointerleave", handlePointerLeave);
    onCleanup(() => {
      hideTrigger.clear();
      scrollContainer?.removeEventListener("pointermove", updatePosition);
      scrollContainer?.removeEventListener("pointerleave", handlePointerLeave);
      unregisterSelectionHandler();
    });
  });

  return (
    <DropdownMenu
      title="Block actions"
      anchorPoint={props.anchorPoint}
      portal={false}
      positioningStrategy="absolute"
      onContextMenuChange={setContextMenuMode}
      trigger={() => (
        <div
          class="absolute pointer-events-auto"
          data-block-menu-trigger
          data-menu
          style={{
            left: `${coords().left}px`,
            top: `${coords().top}px`,
            visibility: triggerVisible() ? "visible" : "hidden"
          }}
        >
          <div
            class="absolute -left-2 top-0 w-2 pointer-events-auto"
            style={{ height: `${hoverAreaHeight()}px` }}
          />
          <div
            class="absolute left-0 w-full pointer-events-auto"
            style={{
              height: `${Math.max(0, hoverAreaHeight() - BLOCK_CONTROL_SIZE)}px`,
              top: `${BLOCK_CONTROL_SIZE}px`
            }}
          />
          <IconButton
            icon="i-lucide:ellipsis"
            variant="outlined"
            color="contrast"
            size="small"
            text="soft"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();

              if (!props.editor) {
                return;
              }

              const { state } = props.editor;
              const node = state.doc.nodeAt(currentNodePos());
              const dom = node ? props.editor.view.nodeDOM(currentNodePos()) : null;
              const target =
                node && dom instanceof HTMLElement ? { dom, node, pos: currentNodePos() } : null;

              if (
                target &&
                currentNodePos() >= 0 &&
                (!isBlockSelection(props.editor.state.selection) ||
                  !isTargetInBlockSelection(props.editor, target))
              ) {
                props.editor
                  .chain()
                  .focus()
                  .setBlockSelection({
                    from: currentNodePos(),
                    to: currentNodePos() + target.node.nodeSize,
                    depth: state.doc.resolve(currentNodePos()).depth
                  })
                  .run();
              }

              setTriggerAvailable(true);
              props.setMenuOpened(true);
            }}
          />
        </div>
      )}
      class="absolute inset-0 pointer-events-none"
      style={{
        "z-index": String(EDITOR_MENU_Z_INDEX.blockMenu)
      }}
      opened={props.menuOpened}
      setOpened={handleOpenedChange}
      cardProps={{
        ...{ "data-block-action-menu": props.menuID },
        class: imageItems().length || codeItems().length ? "w-64" : "w-48"
      }}
      items={menuItems()}
    />
  );
};

export { BlockMenu };
