import { Button, Checkbox, Dropdown, Skeleton, TagList } from "@andesine/components";
import clsx from "clsx";
import {
  type Accessor,
  type Component,
  createContext,
  createEffect,
  createMemo,
  createSignal,
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
import { coversRestrictedLineage } from "@andesine/contracts/permissions";
import { getScopeItems, MAX_SELECTED_SCOPE_ITEMS } from "./configuration";

interface CollectionTreeFieldProps {
  disabled: boolean;
  /** Whether "All" and selected collections cover restricted content without own selections. */
  restrictedContent: boolean;
  /** Lists only collections with publishing enabled; their topmost ones become top-level. */
  publishingOnly?: boolean;
  /** Lists only restricted collections; nested ones stay under their restricted ancestors. */
  restrictedOnly?: boolean;
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
        class="text-row"
        icon={
          <Show
            when={all() && workspaceLogo()}
            fallback={
              <div
                class={clsx(
                  "h-5 w-5 text-gray-400",
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
                class="h-5 w-5 rounded-md object-contain"
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
                checked={state()}
                controlClass="h-4.5 w-4.5"
                iconClass="h-3.5 w-3.5"
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
// Checking a collection selects its subtree; restricted collections need their own selection unless
// `restrictedContent` is on. Unchecking a covered collection replaces its covering root (or "All")
// with the remaining children.
const CollectionTreeField: Component<CollectionTreeFieldProps> = (props) => {
  const { content } = useWorkspace();
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
  // The local tree already omits collections the member cannot access.
  const isVisible = (node: CollectionNode) => {
    const allowedByPublishing =
      !props.publishingOnly ||
      node.id === TREE_ROOT_ID ||
      content.isCollectionPublishingEnabled(node.id);
    const allowedByRestrictedOnly =
      !props.restrictedOnly ||
      node.id === TREE_ROOT_ID ||
      content.collections.isRestrictionRoot({ collectionID: node.id });

    return allowedByPublishing && allowedByRestrictedOnly;
  };
  const nodes = createMemo(() => {
    const visible = [...allNodes().values()].filter(isVisible);
    const visibleIDs = new Set(visible.map((node) => node.id));
    // Collections under hidden parents move up to the top level.
    const orphanIDs = visible
      .filter((node) => node.id !== TREE_ROOT_ID)
      .filter((node) => !visibleIDs.has(node.ancestors.at(-1) ?? TREE_ROOT_ID))
      .map((node) => node.id);

    return new Map(
      visible.map((node) => {
        const children = node.children.filter((id) => visibleIDs.has(id));

        return [
          node.id,
          {
            ...node,
            ancestors: node.ancestors.filter((id) => visibleIDs.has(id)),
            children: node.id === TREE_ROOT_ID ? [...children, ...orphanIDs] : children
          }
        ];
      })
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
  // Matches the server: each restricted boundary on the path needs its own selected collection.
  const isCovered = (id: string, rootIDs: Set<string>): boolean => {
    const node = nodes().get(id);
    const lineage = [...(node?.ancestors ?? []), id];
    const boundaryIDs = lineage.filter((lineageID) => {
      return content.collections.isRestrictionRoot({ collectionID: lineageID });
    });
    const selected = lineage.some((lineageID) => rootIDs.has(lineageID));

    if (props.restrictedContent || !node?.restricted) return selected;

    return (
      selected &&
      coversRestrictedLineage(lineage, boundaryIDs, (lineageID) => {
        return rootIDs.has(lineageID);
      })
    );
  };
  const getCoveringRoot = (id: string): string | null => {
    const node = nodes().get(id);

    if (props.scope.mode === "all") {
      return props.restrictedContent || !node?.restricted ? ALL_COLLECTIONS_ID : null;
    }

    if (!isCovered(id, roots())) return null;

    return [...(node?.ancestors ?? [])].reverse().find((ancestor) => roots().has(ancestor)) ?? null;
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
    if (id === ALL_COLLECTIONS_ID) {
      props.setScope({ mode: "all" });

      return;
    }

    // "All" becomes the top-level collections it covers, so adding one keeps the rest.
    const current =
      props.scope.mode === "all"
        ? topLevelIDs().filter((topLevelID) => getState(topLevelID) === true)
        : [...roots()];
    const next = [...new Set([...current, id])];

    // A newly selected root replaces the selected descendants that stay covered without them.
    setRoots(
      next.filter((root) => {
        const isDescendant = Boolean(nodes().get(root)?.ancestors.includes(id));

        return !isDescendant || !isCovered(root, new Set(next.filter((other) => other !== root)));
      })
    );
  };
  const deselect = (id: string) => {
    const coveringRoot = id === ALL_COLLECTIONS_ID ? null : getCoveringRoot(id);

    if (id === ALL_COLLECTIONS_ID) {
      props.setScope({ mode: "selected", roots: [] });

      return;
    }

    if (roots().has(id) || !coveringRoot) {
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

      // Only covered siblings stay, so restricted ones are not granted by the split.
      return getChildren(parentID).filter((childID) => {
        return childID !== next && getState(childID) === true;
      });
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
            cardProps={{
              class: "max-h-96 overflow-y-auto bg-white p-1 scrollbar-sm scrollbar-white"
            }}
            trigger={() => (
              <Button
                class="flex w-full items-center px-2"
                variant="secondary"
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
