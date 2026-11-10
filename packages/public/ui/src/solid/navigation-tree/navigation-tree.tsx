import {
  type JSX,
  type ParentComponent,
  createContext,
  createUniqueId,
  splitProps,
  useContext
} from "solid-js";
import {
  type NavigationTree as NavigationTreeState,
  type NavigationTreeItem,
  createNavigationTree
} from "./create-navigation-tree";

interface ItemContextValue {
  item: NavigationTreeItem;
  contentID: string;
}

interface RootProps extends JSX.HTMLAttributes<HTMLElement> {
  items: NavigationTreeItem[];
  storageKey?: string;
  /** Groups up to this depth start expanded. */
  defaultDepth?: number;
}

interface ItemProps extends JSX.LiHTMLAttributes<HTMLLIElement> {
  item: NavigationTreeItem;
}

const TreeContext = createContext<NavigationTreeState>();
const ItemContext = createContext<ItemContextValue>();

const useTree = (): NavigationTreeState => {
  const tree = useContext(TreeContext);

  if (!tree) throw new Error("NavigationTree parts must be inside NavigationTree.Root.");

  return tree;
};
const useItem = (): ItemContextValue => {
  const item = useContext(ItemContext);

  if (!item) throw new Error("NavigationTree item parts must be inside NavigationTree.Item.");

  return item;
};
const Root: ParentComponent<RootProps> = (props) => {
  const [local, rest] = splitProps(props, ["items", "storageKey", "defaultDepth"]);
  const tree = createNavigationTree({
    items: () => local.items,
    storageKey: local.storageKey,
    defaultDepth: local.defaultDepth
  });

  return (
    <TreeContext.Provider value={tree}>
      <nav
        aria-label="Documentation"
        {...rest}
        data-scope="navigation-tree"
        data-part="root"
        data-storage-key={local.storageKey}
      />
    </TreeContext.Provider>
  );
};
const List: ParentComponent<JSX.HTMLAttributes<HTMLUListElement>> = (props) => {
  return <ul {...props} data-scope="navigation-tree" data-part="list" />;
};
const Item: ParentComponent<ItemProps> = (props) => {
  const [local, rest] = splitProps(props, ["item"]);
  const tree = useTree();
  const contentID = createUniqueId();
  const isGroup = (): boolean => Boolean(local.item.children?.length);

  return (
    <ItemContext.Provider value={{ item: local.item, contentID }}>
      <li
        {...rest}
        data-scope="navigation-tree"
        data-part="item"
        data-id={local.item.id}
        data-current={local.item.current || undefined}
        data-active={local.item.active || undefined}
        data-state={isGroup() ? (tree.isExpanded(local.item.id) ? "open" : "closed") : undefined}
      />
    </ItemContext.Provider>
  );
};
/** The item's page link. Activation never expands or collapses a group. */
const Link: ParentComponent<JSX.AnchorHTMLAttributes<HTMLAnchorElement>> = (props) => {
  const { item } = useItem();

  return (
    <a
      href={item.href}
      aria-current={item.current ? "page" : undefined}
      {...props}
      data-scope="navigation-tree"
      data-part="link"
    />
  );
};
const GroupTrigger: ParentComponent<JSX.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => {
  const tree = useTree();
  const { item, contentID } = useItem();
  const expanded = (): boolean => tree.isExpanded(item.id);

  return (
    <button
      type="button"
      {...props}
      aria-expanded={expanded()}
      aria-controls={contentID}
      data-scope="navigation-tree"
      data-part="group-trigger"
      data-state={expanded() ? "open" : "closed"}
      onClick={() => tree.setExpanded(item.id, !expanded())}
    />
  );
};
const GroupContent: ParentComponent<JSX.HTMLAttributes<HTMLDivElement>> = (props) => {
  const tree = useTree();
  const { item, contentID } = useItem();
  const expanded = (): boolean => tree.isExpanded(item.id);

  return (
    <div
      {...props}
      id={contentID}
      hidden={!expanded()}
      data-scope="navigation-tree"
      data-part="group-content"
      data-state={expanded() ? "open" : "closed"}
    />
  );
};
const NavigationTree = { Root, List, Item, Link, GroupTrigger, GroupContent };

export { NavigationTree };
