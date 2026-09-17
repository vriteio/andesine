import {
  TREE_ROOT_ID,
  Tree,
  TreeItem,
  TreeLevel,
  type TreeMap,
  useTree
} from "#web/components/tree";
import { useWorkspace } from "#web/context/workspace";
import { usePublishing } from "#web/context/publishing";
import {
  type PublishingChannelContent,
  type PublishingChannelContentCollection
} from "#web/lib/data";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { type MenuItem, Spinner } from "@andesine/components";
import clsx from "clsx";
import { type Component, createMemo, Show } from "solid-js";
import {
  PublishingPanelActions,
  type PublishingPanelActionInput,
  type PublishingPanelMutationAction
} from "./actions";
import { createPublishingPanelEntryOccurrences } from "./entries";
import { type PublishingRevertTarget } from "./revert";
import { PublishingStatusIcon } from "./status";
import { type PublishingPanelEntryOccurrence } from "./types";
import { withWorkspacePanelParams } from "../panel-navigation";

interface PublishingPanelTreeProps {
  channel: string;
  collectionID: string;
  content: PublishingChannelContent;
  mutationAction?: PublishingPanelMutationAction;
  mutationPending: boolean;
  revertCompleted: number;
  onAction(input: PublishingPanelActionInput): void;
  onMenuItemsChange(items: MenuItem[]): void;
  onRevert(target: PublishingRevertTarget): void;
  scrollableContainer(): HTMLElement | null;
}
interface PublishingPanelCollectionProps extends PublishingPanelTreeProps {
  collection: PublishingChannelContentCollection;
  collectionsByID: Map<string, PublishingChannelContentCollection>;
  entriesByID: Map<string, PublishingPanelEntryOccurrence>;
  topLevel?: boolean;
  tree: () => TreeMap;
}
interface PublishingPanelEntryProps extends PublishingPanelTreeProps {
  entry: PublishingPanelEntryOccurrence;
  topLevel?: boolean;
}
interface PublishingPanelCollectionDescendants {
  entryIDs: string[];
  levelIDs: string[];
}
interface PublishingPanelSelectionInput {
  collectionsByID: Map<string, PublishingChannelContentCollection>;
  entriesByID: Map<string, PublishingPanelEntryOccurrence>;
  selection: string[];
  tree: TreeMap;
}

const getCollectionDescendants = (
  tree: TreeMap,
  collectionID: string
): PublishingPanelCollectionDescendants => {
  const entryIDs: string[] = [];
  const levelIDs: string[] = [];
  const collect = (levelID: string) => {
    const level = tree[levelID];

    if (!level) return;

    entryIDs.push(...level.items);
    for (const childLevelID of level.levels) {
      levelIDs.push(childLevelID);
      collect(childLevelID);
    }
  };

  collect(collectionID);

  return { entryIDs, levelIDs };
};
const transformCollectionSelection = (input: PublishingPanelSelectionInput): string[] => {
  const selectedIDs = new Set(input.selection);
  const collections = [...input.collectionsByID.values()]
    .map((collection) => ({
      collection,
      descendants: getCollectionDescendants(input.tree, collection.collectionID)
    }))
    .sort((left, right) => {
      return left.descendants.levelIDs.length - right.descendants.levelIDs.length;
    });

  for (const { collection, descendants } of collections) {
    const selectableCollectionIDs = descendants.levelIDs.filter((collectionID) => {
      const descendant = input.collectionsByID.get(collectionID);

      return Boolean(
        descendant &&
        descendant.status !== "published" &&
        (descendant.canPublish || descendant.canRevert || descendant.canUnpublish)
      );
    });
    const selectableEntryIDs = descendants.entryIDs.filter((entryID) => {
      const entry = input.entriesByID.get(entryID);

      return Boolean(entry && (entry.canPublish || entry.canRevert || entry.canUnpublish));
    });
    const selectableDescendantIDs = [...selectableCollectionIDs, ...selectableEntryIDs];
    const allDescendantsSelected =
      selectableDescendantIDs.length > 0 &&
      selectableDescendantIDs.every((id) => selectedIDs.has(id));

    if (allDescendantsSelected) selectedIDs.add(collection.collectionID);
  }

  return [...selectedIDs];
};

const PublishingPanelEntry: Component<PublishingPanelEntryProps> = (props) => {
  const { workspaceID } = useWorkspace();
  const publishing = usePublishing();
  const navigate = useNavigate();
  const [panelSearchParams] = useSearchParams();
  const [{ isSelected }] = useTree();
  const reverting = () => publishing.isEntryReverting(props.entry.entryID);
  const open = () => {
    const searchParams = new URLSearchParams();

    if (props.entry.versionID) {
      searchParams.set("snapshotID", props.content.snapshotID);
      searchParams.set("version", props.entry.versionID);
      if (props.entry.kind === "working") searchParams.set("compare", "current");
    }

    if (props.channel !== "published") searchParams.set("channel", props.channel);

    const query = searchParams.size > 0 ? `?${searchParams.toString()}` : "";

    navigate(
      withWorkspacePanelParams(
        `/${workspaceID()}/${props.entry.entryID}${query}`,
        panelSearchParams
      )
    );
  };
  const selectable = () => {
    return (
      !reverting() && (props.entry.canPublish || props.entry.canRevert || props.entry.canUnpublish)
    );
  };
  const statusLabel = () => {
    if (!props.entry.moved) return undefined;

    return props.entry.kind === "accepted" ? "Moved, pending removal" : "Moved, pending changes";
  };

  return (
    <TreeItem
      id={props.entry.id}
      label={props.entry.name}
      class={props.topLevel ? undefined : "!rounded-none"}
      icon={
        <div
          class={clsx(
            "h-full w-full i-lucide:file-text",
            isSelected(props.entry.id) ? "bg-gradient-to-tr" : "text-gray-400"
          )}
        />
      }
      topLevel={props.topLevel}
      checkbox={selectable()}
      selectable={selectable()}
      onClick={open}
      actions={
        <div class="flex h-7 w-7 shrink-0 items-center justify-center">
          <Show when={!reverting()} fallback={<Spinner class="h-4 w-4" color="primary" />}>
            <PublishingStatusIcon
              deleted={props.entry.deleted}
              label={statusLabel()}
              status={props.entry.status}
            />
          </Show>
        </div>
      }
      renderLabel={(label) => (
        <span
          class={clsx("min-w-0 flex-1 truncate", props.entry.kind === "accepted" && "line-through")}
        >
          {label}
        </span>
      )}
    />
  );
};
const PublishingPanelCollection: Component<PublishingPanelCollectionProps> = (props) => {
  const publishing = usePublishing();
  const [{ isExpanded, selection }, { setSelection, toggleExpanded }] = useTree();
  const descendants = createMemo(() => {
    return getCollectionDescendants(props.tree(), props.collection.collectionID);
  });
  const selectableIDs = createMemo(() => {
    const { entryIDs, levelIDs } = descendants();
    const collectionIDs = [props.collection.collectionID, ...levelIDs].filter((collectionID) => {
      const collection = props.collectionsByID.get(collectionID);

      return Boolean(
        collection &&
        !publishing.isCollectionReverting(collectionID) &&
        collection.status !== "published" &&
        (collection.canPublish || collection.canRevert || collection.canUnpublish)
      );
    });
    const selectableEntryIDs = entryIDs.filter((entryID) => {
      const entry = props.entriesByID.get(entryID);

      return Boolean(
        entry &&
        !publishing.isEntryReverting(entry.entryID) &&
        (entry.canPublish || entry.canRevert || entry.canUnpublish)
      );
    });

    return [...collectionIDs, ...selectableEntryIDs];
  });
  const derivedSelection = createMemo(() => {
    return new Set(
      transformCollectionSelection({
        collectionsByID: props.collectionsByID,
        entriesByID: props.entriesByID,
        selection: selection(),
        tree: props.tree()
      })
    );
  });
  const unpublishedEntryCount = () => descendants().entryIDs.length;
  const status = () => {
    if (
      props.collection.status === "pending-publish" ||
      props.collection.status === "pending-removal"
    ) {
      return props.collection.status;
    }

    return unpublishedEntryCount() > 0 ? "changes" : props.collection.status;
  };
  const statusLabel = () => {
    const count = unpublishedEntryCount();

    if (props.collection.status === "pending-removal") return undefined;

    if (count === 0) {
      if (props.collection.status === "pending-publish") return "Not published";
      if (props.collection.status !== "published") return "Pending structure changes";

      return undefined;
    }

    return `Pending changes: ${count} ${count === 1 ? "entry" : "entries"}${
      props.collection.status !== "published" ? " and collection structure" : ""
    }`;
  };
  const selectionState = (): boolean | "indeterminate" => {
    const ids = selectableIDs();
    const selectedIDs = new Set(selection());
    const selectedCount = ids.filter((id) => selectedIDs.has(id)).length;

    if (derivedSelection().has(props.collection.collectionID)) return true;
    if (selectedCount === 0) return false;

    return "indeterminate";
  };
  const setCollectionSelection = (selected: boolean) => {
    const ids = selectableIDs();
    const selectedIDs = new Set(ids);

    setSelection((current) => {
      if (!selected) return current.filter((id) => !selectedIDs.has(id));

      return [...new Set([...current, ...ids])];
    });
  };
  const selectable = () => selectableIDs().length > 0;
  const reverting = () => publishing.isCollectionReverting(props.collection.collectionID);

  return (
    <div class="flex min-w-0 flex-col">
      <TreeItem
        id={props.collection.collectionID}
        label={props.collection.name}
        class={props.topLevel ? undefined : "!rounded-none"}
        topLevel={props.topLevel}
        icon={
          <div
            class={clsx(
              "h-6 w-6 text-gray-400 transition-transform",
              selectionState() === true && "bg-gradient-to-tr",
              isExpanded(props.collection.collectionID)
                ? "i-material-symbols:folder-open-rounded"
                : "i-material-symbols:folder-rounded"
            )}
          />
        }
        checkbox={selectable() && !reverting()}
        selectable={selectable() && !reverting()}
        selectionState={selectionState()}
        onClick={() => toggleExpanded(props.collection.collectionID)}
        onSelectionChange={setCollectionSelection}
        renderLabel={(label) => (
          <span
            class={clsx(
              "min-w-0 flex-1 truncate",
              props.collection.status === "pending-removal" && "line-through"
            )}
          >
            {label}
          </span>
        )}
        actions={
          <div class="flex h-7 w-7 shrink-0 items-center justify-center">
            <Show when={!reverting()} fallback={<Spinner class="h-4 w-4" color="primary" />}>
              <PublishingStatusIcon
                deleted={props.collection.deleted}
                label={statusLabel()}
                status={status()}
              />
            </Show>
          </div>
        }
      />
      <TreeLevel
        levelID={props.collection.collectionID}
        tree={props.tree}
        emptyMessage="No pending entries"
        renderLevel={(collectionID) => {
          const collection = () => props.collectionsByID.get(collectionID);

          return (
            <Show when={collection()}>
              {(currentCollection) => (
                <PublishingPanelCollection
                  {...props}
                  collection={currentCollection()}
                  topLevel={false}
                />
              )}
            </Show>
          );
        }}
        renderItem={(entryID) => {
          const entry = () => props.entriesByID.get(entryID);

          return (
            <Show when={entry()}>
              {(currentEntry) => (
                <PublishingPanelEntry {...props} entry={currentEntry()} topLevel={false} />
              )}
            </Show>
          );
        }}
      />
    </div>
  );
};
const PublishingPanelTree: Component<PublishingPanelTreeProps> = (props) => {
  const publishing = usePublishing();
  const collectionsByID = createMemo(() => {
    return new Map(
      props.content.collections.map((collection) => [collection.collectionID, collection])
    );
  });
  const entriesByID = createMemo(() => {
    const entries = createPublishingPanelEntryOccurrences({
      collectionID: props.collectionID,
      content: props.content,
      overlays: publishing.getEntryOverlays()
    });

    return new Map(entries.map((entry) => [entry.id, entry]));
  });
  const visibleCollections = createMemo(() => {
    const collections = props.content.collections.filter(
      ({ collectionID }) => collectionID !== props.collectionID
    );
    const visibleCollectionIDs = new Set(
      collections
        .filter(({ status }) => status !== "published")
        .map(({ collectionID }) => collectionID)
    );
    let previousSize = -1;

    for (const entry of entriesByID().values()) {
      if (entry.treeCollectionID && entry.treeCollectionID !== props.collectionID) {
        visibleCollectionIDs.add(entry.treeCollectionID);
      }
    }

    while (previousSize !== visibleCollectionIDs.size) {
      previousSize = visibleCollectionIDs.size;
      for (const collection of collections) {
        if (!visibleCollectionIDs.has(collection.collectionID)) continue;
        if (!collection.parentID || collection.parentID === props.collectionID) continue;

        visibleCollectionIDs.add(collection.parentID);
      }
    }

    return collections
      .filter(({ collectionID }) => visibleCollectionIDs.has(collectionID))
      .sort((left, right) => left.rank.localeCompare(right.rank));
  });
  const tree = createMemo<TreeMap>(() => {
    const collections = visibleCollections();
    const entries = [...entriesByID().values()].sort((left, right) => {
      return right.rank.localeCompare(left.rank) || left.id.localeCompare(right.id);
    });
    const treeMap: TreeMap = { [TREE_ROOT_ID]: { items: [], levels: [] } };

    for (const collection of collections) {
      treeMap[collection.collectionID] = { items: [], levels: [] };
    }

    for (const collection of collections) {
      const parentID =
        collection.parentID === props.collectionID
          ? TREE_ROOT_ID
          : collection.parentID || TREE_ROOT_ID;

      treeMap[parentID]?.levels.push(collection.collectionID);
    }

    for (const entry of entries) {
      const collectionID =
        entry.treeCollectionID === props.collectionID ? TREE_ROOT_ID : entry.treeCollectionID;

      if (collectionID) treeMap[collectionID]?.items.push(entry.id);
    }

    return treeMap;
  });
  const transformSelection = (selection: string[]) => {
    return transformCollectionSelection({
      collectionsByID: collectionsByID(),
      entriesByID: entriesByID(),
      selection,
      tree: tree()
    });
  };

  return (
    <div class="relative flex min-w-0 flex-col">
      <Tree
        keyboard
        marquee
        marqueeContainer={props.scrollableContainer}
        tree={tree}
        levelIDs={() => {
          return Object.fromEntries(
            visibleCollections().map(({ collectionID }) => [collectionID, true])
          );
        }}
        initialExpanded={() => {
          return visibleCollections().map(({ collectionID }) => collectionID);
        }}
        expandedSourceKey={() => `${props.channel}:${props.collectionID}`}
        selectionTransform={transformSelection}
        renderHeader={() => (
          <PublishingPanelActions
            collectionID={props.collectionID}
            content={props.content}
            entries={[...entriesByID().values()]}
            mutationAction={props.mutationAction}
            mutationPending={props.mutationPending}
            revertCompleted={props.revertCompleted}
            transformSelection={transformSelection}
            onAction={props.onAction}
            onMenuItemsChange={props.onMenuItemsChange}
            onRevert={props.onRevert}
          />
        )}
        renderLevel={(collectionID) => {
          const collection = () => collectionsByID().get(collectionID);

          return (
            <Show when={collection()}>
              {(currentCollection) => (
                <PublishingPanelCollection
                  {...props}
                  collection={currentCollection()}
                  collectionsByID={collectionsByID()}
                  entriesByID={entriesByID()}
                  topLevel
                  tree={tree}
                />
              )}
            </Show>
          );
        }}
        renderItem={(entryID) => {
          const entry = () => entriesByID().get(entryID);

          return (
            <Show when={entry()}>
              {(currentEntry) => (
                <PublishingPanelEntry {...props} entry={currentEntry()} topLevel />
              )}
            </Show>
          );
        }}
      />
    </div>
  );
};

export { PublishingPanelTree };
