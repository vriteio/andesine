import { type Accessor, createSignal, onCleanup, onMount } from "solid-js";
import { isServer } from "solid-js/web";
import { readSession, writeSession } from "../../core/storage";

interface NavigationTreeItem {
  id: string;
  label: string;
  href?: string;
  current?: boolean;
  /** The item contains the current page. Active groups are always expanded on load. */
  active?: boolean;
  children?: NavigationTreeItem[];
}

interface NavigationTreeOptions {
  items: Accessor<NavigationTreeItem[]>;
  /**
   * Keeps expanded groups in session storage, shared by trees with the same key, so the tree
   * stays the same between pages.
   */
  storageKey?: string;
  /** Groups up to this depth start expanded, e.g. `2` for the first two levels. */
  defaultDepth?: number;
}

interface NavigationTree {
  isExpanded(id: string): boolean;
  setExpanded(id: string, expanded: boolean): void;
}

const syncEvent = "andesine:navigation-tree";

const getActiveGroups = (items: NavigationTreeItem[]): string[] => {
  return items.flatMap((item) => {
    return item.children?.length && item.active ? [item.id, ...getActiveGroups(item.children)] : [];
  });
};
const getDefaultGroups = (items: NavigationTreeItem[], depth: number): string[] => {
  return depth > 0
    ? items.flatMap((item) => {
        return item.children?.length
          ? [item.id, ...getDefaultGroups(item.children, depth - 1)]
          : [];
      })
    : [];
};
/** The saved groups replace the defaults; the current page's groups are always expanded. */
const getInitialGroups = (options: NavigationTreeOptions): Set<string> => {
  const items = options.items();
  const saved = !isServer && options.storageKey ? readSession(options.storageKey) : undefined;
  const base = Array.isArray(saved)
    ? saved.map(String)
    : getDefaultGroups(items, options.defaultDepth ?? 0);

  return new Set([...base, ...getActiveGroups(items)]);
};
const createNavigationTree = (options: NavigationTreeOptions): NavigationTree => {
  const [expanded, setExpanded] = createSignal(getInitialGroups(options));
  const save = (ids: Set<string>): void => {
    if (!options.storageKey) return;

    writeSession(options.storageKey, [...ids]);
    window.dispatchEvent(
      new CustomEvent(syncEvent, { detail: { key: options.storageKey, ids: [...ids] } })
    );
  };

  onMount(() => {
    if (!options.storageKey) return;

    const sync = (event: Event): void => {
      const { key, ids } = (event as CustomEvent<{ key: string; ids: string[] }>).detail;

      if (key === options.storageKey) setExpanded(new Set(ids));
    };

    // Saves the groups that this page expanded, so they stay expanded on the next page.
    writeSession(options.storageKey, [...expanded()]);
    window.addEventListener(syncEvent, sync);
    onCleanup(() => window.removeEventListener(syncEvent, sync));
  });

  return {
    isExpanded: (id) => expanded().has(id),
    setExpanded: (id, open) => {
      const ids = new Set(expanded());

      if (open) {
        ids.add(id);
      } else {
        ids.delete(id);
      }

      setExpanded(ids);
      save(ids);
    }
  };
};

export { createNavigationTree };
export type { NavigationTreeItem, NavigationTreeOptions, NavigationTree };
