import { type MenuItem } from "@andesine/components";
import { createContext, createSignal, type ParentComponent, useContext } from "solid-js";
import { useTree } from "./tree-context";
import { useTreeKeyboard } from "./use-tree-keyboard";

interface TreeKeyboardItem {
  element(): HTMLElement | undefined;
  label(): string;
  selectable(): boolean;
  menuItems(): MenuItem[];
  openMenu(): void;
  activate(): void;
}

const TreeKeyboardContext = createContext<Map<string, TreeKeyboardItem>>();
const TreeKeyboard: ParentComponent = (props) => {
  const items = new Map<string, TreeKeyboardItem>();
  const [{ focusedID, selection, flattenedOrder }, tree] = useTree();
  const [pointerInside, setPointerInside] = createSignal(false);

  let root: HTMLDivElement | undefined;

  const getFocusedVisibleID = () => {
    const activeID = document.activeElement?.getAttribute("data-tree-item");
    const id = activeID || focusedID();

    return id && flattenedOrder().includes(id) ? id : null;
  };
  const getTargetID = () => selection()[0] || getFocusedVisibleID();
  const runAction = (shortcut: string) => {
    const id = getTargetID();
    const item = id ? items.get(id) : undefined;
    const action = item?.menuItems().find((action) => action.shortcut === shortcut);

    if (!action || action.disabled || !action.onClick) return false;

    void action.onClick();
    return true;
  };
  const openMenu = () => {
    const id = getTargetID();
    const item = id ? items.get(id) : undefined;

    if (!item || !item.menuItems().length) return false;

    item.openMenu();
    return true;
  };
  const keyboard = useTreeKeyboard({
    active: () => {
      const active = document.activeElement;
      const focusedTree = active?.closest("[data-tree-keyboard]");

      if (focusedTree) {
        return (
          focusedTree === root &&
          (active === root || Boolean(active?.hasAttribute("data-tree-item")))
        );
      }

      return pointerInside();
    },
    getFocusedVisibleID,
    getLabel: (id) => items.get(id)?.label() || "",
    canSelect: (id) => items.get(id)?.selectable() ?? false,
    scrollItemIntoView: (id) => {
      const element = items.get(id)?.element();

      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ block: "nearest" });
    },
    activateFocused: () => {
      const id = getFocusedVisibleID();
      const item = id ? items.get(id) : undefined;

      if (!item) return false;

      item.activate();
      return true;
    },
    renameTarget: () => selection().length <= 1 && runAction("f2"),
    deleteTarget: () => runAction("$mod+backspace"),
    copyTargetID: () => selection().length <= 1 && runAction("$mod+alt+c"),
    openMenu
  });

  return (
    <TreeKeyboardContext.Provider value={items}>
      <div
        ref={root}
        data-tree-keyboard
        tabindex="0"
        class="flex min-w-0 flex-col outline-none"
        onPointerEnter={() => setPointerInside(true)}
        onPointerLeave={() => setPointerInside(false)}
        onFocus={(event) => {
          if (event.target !== root) return;

          const id = getFocusedVisibleID() || flattenedOrder()[0];

          if (id) {
            tree.setFocusedItem(id, "keyboard");
          }
        }}
        onPointerDown={(event) => {
          const target = event.target;
          const item =
            target instanceof Element ? target.closest<HTMLElement>("[data-tree-item]") : null;

          keyboard.resetRange();
          if (!item || target.closest("button, a, input, textarea, select, [data-scope='menu']"))
            return;

          item.focus({ preventScroll: true });
        }}
      >
        {props.children}
      </div>
    </TreeKeyboardContext.Provider>
  );
};

const useTreeKeyboardItems = () => useContext(TreeKeyboardContext);

export { TreeKeyboard, useTreeKeyboardItems };
