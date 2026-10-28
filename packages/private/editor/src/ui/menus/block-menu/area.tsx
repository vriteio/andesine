import { isBlockSelection, setBlockSelectionAtCoords } from "#editor/extensions";
import type { BlockActions, EditorIcons, EditorLinks, ElementViews } from "#editor/client-types";
import { DropdownArea, useShortcuts } from "@andesine/components";
import { type Editor, type EditorEvents, isTextSelection } from "@tiptap/core";
import {
  type Accessor,
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  type ParentComponent,
  Show
} from "solid-js";
import { Portal } from "solid-js/web";
import { BlockMenu } from "./block-menu";
import { BlockMenuContextProvider } from "./context";
import type { BlockControlRange } from "#editor/ui/block-control-targeting";
import { rangeContainsInheritedField } from "#editor/ui/block-utils";
import { OPEN_BLOCK_MENU_META } from "#editor/ui/constants";
import { isShown } from "#editor/ui/keyboard-stops";

interface BlockMenuAreaProps {
  editor: Editor | null;
  blockActions?: BlockActions;
  elementViews?: ElementViews;
  links?: EditorLinks;
  icons?: EditorIcons;
  menuContainerRef: Accessor<HTMLElement | null>;
  notify(type: "success" | "error", text: string): void;
}

const BlockMenuArea: ParentComponent<BlockMenuAreaProps> = (props) => {
  const registerShortcuts = useShortcuts();
  const menuID = createUniqueId();
  const [menuOpened, setMenuOpened] = createSignal(false);
  const [menuAnchorPoint, setMenuAnchorPoint] = createSignal<{ x: number; y: number } | null>(null);
  const [contextMenuPoint, setContextMenuPoint] = createSignal<{ x: number; y: number } | null>(
    null
  );
  const [textMenuSelectionRange, setTextMenuSelectionRange] =
    createSignal<BlockControlRange | null>(null);
  const handleCopy = () => {
    const editor = props.editor;

    if (!editor || editor.isDestroyed) return false;

    const { dom, text } = editor.view.serializeForClipboard(editor.state.selection.content());

    void (async () => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([dom.innerHTML], { type: "text/html" })
          })
        ]);
      } catch {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          props.notify("error", "Failed to copy blocks to the clipboard.");
        }
      }
    })();

    return true;
  };
  const handleDelete = () => {
    const editor = props.editor;

    if (!editor || editor.isDestroyed) return false;

    const { from, to } = editor.state.selection;

    if (rangeContainsInheritedField(editor.state.doc, from, to)) return false;

    return editor.chain().focus().deleteSelection().run();
  };
  const openMenu = (reference?: HTMLElement) => {
    if (reference) {
      const referenceRect = reference.getBoundingClientRect();

      setMenuAnchorPoint({
        x: referenceRect.right,
        y: referenceRect.bottom
      });
    } else {
      setMenuAnchorPoint(null);
    }

    setMenuOpened(true);
  };
  const handleMenuOpenedChange = (opened: boolean) => {
    setMenuOpened(opened);

    if (!opened) {
      setMenuAnchorPoint(null);
    }
  };

  createEffect(() => {
    const editor = props.editor;

    if (!editor || editor.isDestroyed) return;

    const canHandleShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[data-element-editing] [data-element-tag="opening"]')
      )
        return false;
      const insideMenu =
        menuOpened() &&
        target instanceof Element &&
        target.closest("[data-block-action-menu]")?.getAttribute("data-block-action-menu") ===
          menuID;

      return (
        !editor.isDestroyed &&
        target instanceof Node &&
        (editor.view.dom.contains(target) || insideMenu) &&
        isBlockSelection(editor.state.selection)
      );
    };
    const handleShortcut = (event: KeyboardEvent, action: () => boolean): boolean => {
      if (!canHandleShortcut(event) || !action()) return false;

      handleMenuOpenedChange(false);

      return true;
    };
    const unregister = registerShortcuts(
      {
        "$mod+backspace": (event) => handleShortcut(event, handleDelete),
        "$mod+c": (event) => handleShortcut(event, handleCopy)
      },
      {
        ignore: (event) => event.repeat || event.isComposing
      }
    );

    onCleanup(unregister);
  });
  // A menu that the keyboard opens, e.g. Enter on a selected file row, by the block's own UI.
  createEffect(() => {
    const editor = props.editor;

    if (!editor || editor.isDestroyed) return;

    const openForBlock = ({ transaction }: EditorEvents["transaction"]) => {
      const pos = transaction.getMeta(OPEN_BLOCK_MENU_META) as number | undefined;
      const node = typeof pos === "number" ? editor.state.doc.nodeAt(pos) : null;

      if (!node) return;

      const id = CSS.escape(node.attrs.id ?? "");
      const areas = editor.view.dom.querySelectorAll<HTMLElement>(
        `[data-block-area="${id}"][data-block-selectable] > *`
      );
      const area = Array.from(areas).find(isShown);
      const dom = editor.view.nodeDOM(pos!);

      openMenu(area ?? (dom instanceof HTMLElement ? dom : undefined));
    };

    editor.on("transaction", openForBlock);
    onCleanup(() => editor.off("transaction", openForBlock));
  });

  return (
    <BlockMenuContextProvider
      value={{
        handleCopy,
        handleDelete,
        openMenu,
        menuOpened,
        setTextMenuSelectionRange
      }}
    >
      <DropdownArea
        onLongPress={(event) => {
          if (!props.editor) return;

          const editor = props.editor;
          const block =
            event.target instanceof Element
              ? event.target.closest("[data-image-node-view], [data-code-block]")
              : null;

          if (block) {
            editor.state.doc.descendants((node, pos) => {
              if (
                !["image", "codeBlock"].includes(node.type.name) ||
                editor.view.nodeDOM(pos) !== block
              ) {
                return;
              }

              editor.commands.setBlockSelection({
                from: pos,
                to: pos + node.nodeSize,
                depth: editor.state.doc.resolve(pos).depth
              });
            });
            return;
          }

          setBlockSelectionAtCoords(props.editor, {
            left: event.clientX,
            top: event.clientY
          });
        }}
        enabled={(event) => {
          if (!props.editor) {
            return false;
          }

          const { view, state } = props.editor;
          const { selection } = state;

          const overBlock =
            event.target instanceof Element &&
            event.target.closest("[data-image-node-view], [data-code-block]");

          if (
            !overBlock &&
            !isBlockSelection(selection) &&
            isTextSelection(selection) &&
            !selection.empty
          ) {
            return false;
          }

          const isInEditor = view.dom.contains(event.target as Node);
          const isTouch = event instanceof PointerEvent && event.pointerType !== "mouse";
          const overTableCell = event.target instanceof Element && event.target.closest("td, th");

          // Table cells open their own menu on long press, like on right click.
          if (isTouch && overTableCell) return false;

          // Where a context menu opens, so block action menus can open in its place.
          if (isInEditor) setContextMenuPoint({ x: event.clientX, y: event.clientY });

          return isInEditor;
        }}
      >
        {props.children}
        <Show when={props.menuContainerRef()} keyed>
          {(menuContainer) => (
            <Portal mount={menuContainer}>
              <BlockMenu
                menuID={menuID}
                notify={props.notify}
                anchorPoint={menuAnchorPoint()}
                contextMenuPoint={contextMenuPoint()}
                editor={props.editor}
                blockActions={props.blockActions}
                elementViews={props.elementViews}
                links={props.links}
                icons={props.icons}
                menuOpened={menuOpened()}
                setMenuOpened={handleMenuOpenedChange}
                textMenuSelectionRange={textMenuSelectionRange()}
              />
            </Portal>
          )}
        </Show>
      </DropdownArea>
    </BlockMenuContextProvider>
  );
};

export { BlockMenuArea };
