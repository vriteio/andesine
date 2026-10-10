import {
  TREE_ROOT_ID,
  Tree,
  TreeItem,
  TreeLevel,
  useTree,
  type TreeMap
} from "#web/components/tree";
import clsx from "clsx";
import { type Component, createMemo, Show } from "solid-js";
import { type HostComponentProps } from "./types";

interface TreeNodeProps {
  id: string;
  tree(): TreeMap;
  host: HostComponentProps<"Tree">;
}

type TreeItemData = HostComponentProps<"Tree">["props"]["items"][number];

const ExtensionTreeNode: Component<TreeNodeProps> = (props) => {
  const [{ isExpanded }, { toggleExpanded }] = useTree();
  const item = createMemo(() => props.host.props.items.find(({ id }) => id === props.id));
  const isLevel = () => props.tree()[props.id] !== undefined;
  // Icon classes from extension items come from its generated CSS.
  const icon = () => {
    if (item()?.icon) return item()!.icon;
    if (!isLevel()) return "i-lucide:file";

    return isExpanded(props.id)
      ? "i-material-symbols:folder-open-rounded"
      : "i-material-symbols:folder-rounded";
  };

  return (
    <div class="relative w-full">
      <TreeItem
        id={props.id}
        label={item()?.label ?? ""}
        highlighted={props.host.props.selected === props.id}
        icon={<div class={clsx("h-5 w-5 text-gray-400", icon())} />}
        onClick={() => {
          if (isLevel()) toggleExpanded(props.id);

          props.host.emit("onSelect", props.id);
        }}
      />
      <Show when={isLevel()}>
        <TreeLevel
          levelID={props.id}
          tree={props.tree}
          renderLevel={(id) => <ExtensionTreeNode id={id} tree={props.tree} host={props.host} />}
          renderItem={(id) => <ExtensionTreeNode id={id} tree={props.tree} host={props.host} />}
        />
      </Show>
    </div>
  );
};
/** Builds the tree map from the flat item list; unknown or own parents mean top level. */
const toTreeMap = (items: TreeItemData[]): TreeMap => {
  const ids = new Set(items.map(({ id }) => id));
  const parentOf = (item: TreeItemData): string => {
    const hasParent = item.parent !== undefined && item.parent !== item.id && ids.has(item.parent);

    return hasParent ? item.parent! : TREE_ROOT_ID;
  };
  const parents = new Set(items.map(parentOf));
  const map: TreeMap = { [TREE_ROOT_ID]: { items: [], levels: [] } };

  for (const item of items) {
    const parent = (map[parentOf(item)] ??= { items: [], levels: [] });

    if (parents.has(item.id)) {
      map[item.id] ??= { items: [], levels: [] };
      parent.levels.push(item.id);
    } else {
      parent.items.push(item.id);
    }
  }

  return map;
};
const ExtensionTree: Component<HostComponentProps<"Tree">> = (props) => {
  const tree = createMemo(() => toTreeMap(props.props.items));

  return (
    <Tree
      tree={tree}
      itemHeight="2rem"
      emptyMessage={props.props.emptyLabel ?? "No items"}
      renderLevel={(id) => <ExtensionTreeNode id={id} tree={tree} host={props} />}
      renderItem={(id) => <ExtensionTreeNode id={id} tree={tree} host={props} />}
    />
  );
};

export { ExtensionTree };
