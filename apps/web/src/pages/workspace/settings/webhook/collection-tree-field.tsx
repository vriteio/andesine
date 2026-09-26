import { Button, Checkbox, Dropdown, Skeleton, TagList } from "@andesine/components";
import clsx from "clsx";
import {
  type Accessor,
  type Component,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  on,
  Show,
  untrack,
  useContext
} from "solid-js";
import {
  Tree,
  TREE_ROOT_ID,
  TreeItem,
  TreeLevel,
  type TreeMap,
  useTree
} from "#web/components/tree";
import { useWorkspace } from "#web/context/workspace";
import type { Webhook } from "#web/lib/data";
import { getScopeItems, MAX_SELECTED_SCOPE_ITEMS } from "./configuration";

interface CollectionTreeFieldProps {
  disabled: boolean;
  restrictedContent: boolean;
  scope: Webhook["collections"];
  setScope(scope: Webhook["collections"]): void;
}
interface CollectionNode {
  id: string;
  name: string;
  ancestors: string[];
  children: string[];
  restricted: boolean;
}
interface CollectionTreeContextValue {
  collectionCount: Accessor<number>;
  selectedCount: Accessor<number>;
  disabled: Accessor<boolean>;
  nodes: Accessor<Map<string, CollectionNode>>;
  selectedIDs: Accessor<string[]>;
  treeMap: Accessor<TreeMap>;
  getState(id: string): CollectionState;
  setSelected(id: string, selected: boolean): void;
}
interface CollectionNodeItemProps {
  id: string;
}
interface CollectionTreeProps {
  initialExpanded: string[];
}

type CollectionState = boolean | "indeterminate";

const ALL_COLLECTIONS_ID = "webhook-all-collections";
const CollectionTreeContext = createContext<CollectionTreeContextValue>();

const useCollectionTree = () => useContext(CollectionTreeContext)!;
const CollectionNodeItem: Component<CollectionNodeItemProps> = (props) => {
  const tree = useCollectionTree();
  const { currentWorkspace } = useWorkspace();
  const [{ isExpanded }, { toggleExpanded }] = useTree();
  const all = () => props.id === ALL_COLLECTIONS_ID;
  const workspaceLogo = () => currentWorkspace()?.logo;
  const node = () => tree.nodes().get(props.id);
  const expandable = () => all() || Boolean(node()?.children.length);
  const state = () => tree.getState(props.id);
  const icon = () => {
    if (all()) return "i-lucide:hexagon";
    if (!expandable()) return "i-material-symbols:folder-open-rounded";

    return isExpanded(props.id)
      ? "i-material-symbols:folder-open-rounded"
      : "i-material-symbols:folder-rounded";
  };

  return (
    <div class="relative w-full">
      <TreeItem
        id={props.id}
        label={all() ? currentWorkspace()?.name || "Workspace" : node()?.name || ""}
        topLevel={all()}
        icon={
          <Show
            when={all() && workspaceLogo()}
            fallback={
              <div
                class={clsx(
                  "h-6 w-6 text-gray-400",
                  icon(),
                  state() !== false && "bg-gradient-to-tr"
                )}
              />
            }
          >
            {(logo) => (
              <img
                src={logo()}
                alt={`${currentWorkspace()?.name} logo`}
                class="h-6 w-6 rounded-md object-contain"
              />
            )}
          </Show>
        }
        onClick={() => {
          if (expandable()) toggleExpanded(props.id);
        }}
        actions={
          <Show when={!tree.disabled()}>
            <div
              class="flex h-7 w-7 shrink-0 items-center justify-center media-mouse:hidden media-mouse:group-hover:flex"
              onClick={(event) => event.stopPropagation()}
            >
              <Checkbox
                size="small"
                checked={state()}
                setChecked={(selected) => tree.setSelected(props.id, selected)}
              />
            </div>
          </Show>
        }
      />
      <TreeLevel
        levelID={props.id}
        tree={tree.treeMap}
        emptyMessage="No collections"
        renderLevel={(id) => <CollectionNodeItem id={id} />}
      />
    </div>
  );
};
const SelectionBackdrop: Component = () => {
  const tree = useCollectionTree();
  const [{ selection }, { setExactSelection }] = useTree();

  createEffect(() => {
    const selectedIDs = tree.selectedIDs();
    const current = selection();
    const same =
      current.length === selectedIDs.length && selectedIDs.every((id) => current.includes(id));

    if (!same) setExactSelection(selectedIDs);
  });

  return null;
};
const CollectionTree: Component<CollectionTreeProps> = (props) => {
  const tree = useCollectionTree();
  // Captured once when opened: a reactive value would reset expansion on every change.
  const initialExpanded = untrack(() => props.initialExpanded);
  return (
    <div class="flex flex-col w-full">
      <span class="px-1.5 pb-1 pt-0.5 text-xs text-gray-400">
        {tree.selectedCount()} of {tree.collectionCount()} selected
      </span>
      <Tree
        tree={tree.treeMap}
        initialExpanded={() => initialExpanded}
        renderLevel={(id) => <CollectionNodeItem id={id} />}
      >
        <SelectionBackdrop />
      </Tree>
    </div>
  );
};
// Checking a collection selects its whole subtree. Unchecking a collection covered by a
// checked ancestor (or by "All") replaces that ancestor with its remaining children.
const CollectionTreeField: Component<CollectionTreeFieldProps> = (props) => {
  const { content, hasPermission, currentWorkspace } = useWorkspace();
  const [opened, setOpened] = createSignal(false);
  const allNodes = createMemo(() => {
    const collections = content.collectionsCollection().find().fetch();
    const byID = new Map(collections.map((collection) => [collection.id, collection]));

    return new Map(
      collections.map((collection) => {
        const ancestors = collection.ancestors.filter((id) => byID.has(id) && id !== TREE_ROOT_ID);
        const restricted =
          collection.restricted || ancestors.some((id) => byID.get(id)!.restricted);
        const children = collection.descendants.filter((id) => byID.has(id));

        return [
          collection.id,
          { id: collection.id, name: collection.name, ancestors, children, restricted }
        ];
      })
    );
  });
  // Restricted collections are listed only when they are included and the member may approve
  // that. The local tree already omits collections the member cannot access.
  const showRestricted = () => {
    return props.restrictedContent && hasPermission("read:restricted_collections");
  };
  const nodes = createMemo(() => {
    const visible = [...allNodes().values()].filter((node) => showRestricted() || !node.restricted);
    const visibleIDs = new Set(visible.map((node) => node.id));

    return new Map(
      visible.map((node) => [
        node.id,
        { ...node, children: node.children.filter((id) => visibleIDs.has(id)) }
      ])
    );
  });
  const topLevelIDs = () => nodes().get(TREE_ROOT_ID)?.children || [];
  const roots = createMemo(() => new Set(getScopeItems(props.scope)));
  const treeMap = createMemo<TreeMap>(() => {
    const map: TreeMap = {
      [TREE_ROOT_ID]: { items: [], levels: [ALL_COLLECTIONS_ID] },
      [ALL_COLLECTIONS_ID]: { items: [], levels: topLevelIDs() }
    };

    for (const node of nodes().values()) {
      if (node.id !== TREE_ROOT_ID) map[node.id] = { items: [], levels: node.children };
    }

    return map;
  });
  const unavailableRoots = () => {
    return [...roots()].filter((id) => !nodes().has(id));
  };
  const getChildren = (id: string) => {
    return id === ALL_COLLECTIONS_ID ? topLevelIDs() : nodes().get(id)?.children || [];
  };
  const getCoveringRoot = (id: string): string | null => {
    if (props.scope.mode === "all") return ALL_COLLECTIONS_ID;

    return (
      nodes()
        .get(id)
        ?.ancestors.find((ancestor) => roots().has(ancestor)) ?? null
    );
  };
  const getState = (id: string): CollectionState => {
    const hasSelectedDescendant = [...roots()].some((root) => {
      return id === ALL_COLLECTIONS_ID || nodes().get(root)?.ancestors.includes(id);
    });

    if (id === ALL_COLLECTIONS_ID && props.scope.mode === "all") return true;
    if (roots().has(id) || getCoveringRoot(id)) return true;

    return hasSelectedDescendant ? "indeterminate" : false;
  };
  const selectedIDs = createMemo(() => {
    return [ALL_COLLECTIONS_ID, ...nodes().keys()].filter((id) => {
      return id !== TREE_ROOT_ID && getState(id) === true;
    });
  });
  const setRoots = (next: string[]) => {
    if (next.length <= MAX_SELECTED_SCOPE_ITEMS) props.setScope({ mode: "selected", roots: next });
  };
  const select = (id: string) => {
    const uncovered = [...roots()].filter((root) => !nodes().get(root)?.ancestors.includes(id));

    if (id === ALL_COLLECTIONS_ID) {
      props.setScope({ mode: "all" });

      return;
    }

    // A newly selected root replaces any selected descendants it now covers.
    setRoots([...uncovered, id]);
  };
  const deselect = (id: string) => {
    const coveringRoot = id === ALL_COLLECTIONS_ID ? null : getCoveringRoot(id);

    if (id === ALL_COLLECTIONS_ID) {
      props.setScope({ mode: "selected", roots: [] });

      return;
    }

    if (!coveringRoot) {
      setRoots([...roots()].filter((root) => root !== id));

      return;
    }

    // Walk from the covering root down to the item, keeping every sibling branch.
    const ancestors = nodes().get(id)!.ancestors;
    const path =
      coveringRoot === ALL_COLLECTIONS_ID
        ? [ALL_COLLECTIONS_ID, ...ancestors]
        : ancestors.slice(ancestors.indexOf(coveringRoot));
    const kept = [...roots()].filter((root) => root !== coveringRoot);
    const siblings = path.flatMap((parentID, index) => {
      const next = path[index + 1] ?? id;

      return getChildren(parentID).filter((childID) => childID !== next);
    });

    setRoots([...kept, ...siblings]);
  };
  const collectionCount = () => [...nodes().keys()].filter((id) => id !== TREE_ROOT_ID).length;
  // Counts every covered collection, including those selected through a checked ancestor.
  const selectedCount = () => {
    return selectedIDs().filter((id) => id !== ALL_COLLECTIONS_ID).length;
  };
  const initialExpanded = () => {
    const expanded = [...roots()].flatMap((id) => nodes().get(id)?.ancestors || []);

    return [ALL_COLLECTIONS_ID, ...expanded];
  };
  const context: CollectionTreeContextValue = {
    collectionCount,
    selectedCount,
    disabled: () => props.disabled,
    nodes,
    selectedIDs,
    treeMap,
    getState,
    setSelected: (id, selected) => (selected ? select(id) : deselect(id))
  };

  // Excluding restricted content also removes restricted collections from the selection.
  createEffect(
    on(
      () => props.restrictedContent,
      (restrictedContent) => {
        const selected = [...roots()];
        const kept = selected.filter((id) => !allNodes().get(id)?.restricted);

        if (!restrictedContent && kept.length !== selected.length) setRoots(kept);
      },
      { defer: true }
    )
  );

  return (
    <CollectionTreeContext.Provider value={context}>
      <div class="flex w-62 max-w-full flex-col gap-2">
        {/* Collections load from the browser-only store; keep the trigger's size meanwhile. */}
        <Show when={!content.loading()} fallback={<Skeleton class="h-7 w-full rounded-lg" />}>
          <Dropdown
            title="Collections"
            placement="bottom-end"
            opened={opened()}
            setOpened={setOpened}
            disabled={props.disabled}
            sameWidth
            cardProps={{ class: "max-h-96 overflow-y-auto bg-white p-1 scrollbar-sm" }}
            trigger={() => (
              <Button
                class="flex w-full items-center px-2"
                variant="outlined"
                color="contrast"
                size="small"
                disabled={props.disabled}
              >
                <span
                  class={clsx(
                    "min-w-0 flex-1 truncate text-start",
                    selectedCount() === 0 && "text-gray-400"
                  )}
                >
                  {selectedCount()} of {collectionCount()} collections selected
                </span>
                <span class="i-lucide:chevrons-up-down ml-auto shrink-0 text-gray-400" />
              </Button>
            )}
          >
            <Show when={opened()}>
              <CollectionTree initialExpanded={initialExpanded()} />
            </Show>
          </Dropdown>
        </Show>
        <Show when={unavailableRoots().length}>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-gray-400">
              Selected collections not shown here (removed or restricted)
            </span>
            <TagList
              values={unavailableRoots()}
              disabled={props.disabled}
              getLabel={(id) => id}
              getIcon={() => "i-lucide:circle-help"}
              setValues={(values) => {
                const kept = [...roots()].filter((id) => nodes().has(id));

                setRoots([...kept, ...values]);
              }}
            />
          </div>
        </Show>
      </div>
    </CollectionTreeContext.Provider>
  );
};

export { CollectionTreeField };
