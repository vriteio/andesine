import { Button, IconButton, type MenuItem, Tooltip } from "@andesine/components";
import { useTree } from "#web/components/tree";
import {
  type PublishingChannelContent,
  type PublishingChannelContentCollection
} from "#web/lib/data";
import { type Component, createEffect, createMemo, on, onCleanup, Show } from "solid-js";
import { createPublishingRevertTarget, type PublishingRevertTarget } from "./revert";
import { type PublishingPanelEntryOccurrence } from "./types";

interface PublishingPanelActionInput {
  action: "publish-collection" | "publish-selection" | "unpublish-selection";
  collectionIDs?: string[];
  entryIDs?: string[];
  targetCollectionID?: string;
  unpublishCollectionIDs?: string[];
  unpublishEntryIDs?: string[];
}
interface PublishingPanelActionsProps {
  collectionID: string;
  content: PublishingChannelContent;
  entries: PublishingPanelEntryOccurrence[];
  mutationAction?: PublishingPanelMutationAction;
  mutationPending: boolean;
  revertCompleted: number;
  transformSelection(selection: string[]): string[];
  onAction(input: PublishingPanelActionInput): void;
  onMenuItemsChange(items: MenuItem[]): void;
  onRevert(target: PublishingRevertTarget): void;
}

type PublishingPanelMutationAction = PublishingPanelActionInput["action"] | "revert";

const PublishingPanelActions: Component<PublishingPanelActionsProps> = (props) => {
  const [{ selection }, { setSelection }] = useTree();
  const entriesByID = createMemo(() => {
    return new Map(props.entries.map((entry) => [entry.id, entry]));
  });
  const collectionsByID = createMemo(() => {
    return new Map(
      props.content.collections.map((collection) => [collection.collectionID, collection])
    );
  });
  const transformedSelection = createMemo(() => props.transformSelection(selection()));
  const allItemsSelected = createMemo(() => {
    const selectedIDs = new Set(transformedSelection());
    const selectableCollectionIDs = props.content.collections
      .filter((collection) => {
        return (
          collection.collectionID !== props.collectionID &&
          collection.status !== "published" &&
          (collection.canPublish || collection.canRevert || collection.canUnpublish)
        );
      })
      .map(({ collectionID }) => collectionID);
    const selectableEntryIDs = props.entries
      .filter(({ canPublish, canRevert, canUnpublish }) => {
        return canPublish || canRevert || canUnpublish;
      })
      .map(({ id }) => id);
    const selectableIDs = [...selectableCollectionIDs, ...selectableEntryIDs];

    return selectableIDs.length > 0 && selectableIDs.every((id) => selectedIDs.has(id));
  });
  const useDefaultAction = () => selection().length === 0 || allItemsSelected();
  const selectedEntries = createMemo<PublishingPanelEntryOccurrence[]>(() => {
    return selection().flatMap((occurrenceID) => {
      const entry = entriesByID().get(occurrenceID);

      return entry ? [entry] : [];
    });
  });
  const selectedCollections = createMemo<PublishingChannelContentCollection[]>(() => {
    return selection().flatMap((collectionID) => {
      const collection = collectionsByID().get(collectionID);

      return collection && collection.status !== "published" ? [collection] : [];
    });
  });
  const selectedCount = () => {
    return (
      selectedCollections().length + new Set(selectedEntries().map(({ entryID }) => entryID)).size
    );
  };
  const revertTarget = createMemo(() => {
    const currentSelection = selection();
    const all = useDefaultAction();

    return createPublishingRevertTarget({
      all,
      content: props.content,
      entries: props.entries,
      selection: all ? [] : props.transformSelection(currentSelection)
    });
  });
  const publishableEntries = () => {
    const selectedEntryIDs = new Set(selectedEntries().map(({ entryID }) => entryID));

    return props.entries.filter(({ canPublish, entryID }) => {
      return canPublish && selectedEntryIDs.has(entryID);
    });
  };
  const publishableEntryIDs = () => {
    return [...new Set(publishableEntries().map(({ entryID }) => entryID))];
  };
  const unpublishableEntries = () => {
    const publishableIDs = new Set(publishableEntryIDs());

    return selectedEntries().filter(({ canUnpublish, entryID, status }) => {
      return canUnpublish && status === "pending-removal" && !publishableIDs.has(entryID);
    });
  };
  const unpublishableEntryIDs = () => {
    return [...new Set(unpublishableEntries().map(({ entryID }) => entryID))];
  };
  const publishableCollectionIDs = () => {
    return selectedCollections()
      .filter(({ canPublish }) => canPublish)
      .map(({ collectionID }) => collectionID);
  };
  const unpublishableCollectionIDs = () => {
    return selectedCollections()
      .filter(({ canUnpublish, status }) => canUnpublish && status === "pending-removal")
      .map(({ collectionID }) => collectionID);
  };
  const publishableCount = () => {
    return publishableCollectionIDs().length + publishableEntryIDs().length;
  };
  const unpublishableCount = () => {
    return unpublishableCollectionIDs().length + unpublishableEntryIDs().length;
  };
  const topLevelCollectionIDs = (collectionIDs: string[]) => {
    const selectedIDs = new Set(collectionIDs);

    return collectionIDs.filter((collectionID) => {
      let collection = collectionsByID().get(collectionID);

      while (collection?.parentID) {
        if (selectedIDs.has(collection.parentID)) return false;

        collection = collectionsByID().get(collection.parentID);
      }

      return true;
    });
  };
  const excludeCollectionsInCollections = (
    collectionIDs: string[],
    parentCollectionIDs: string[]
  ) => {
    const parentIDs = new Set(parentCollectionIDs);

    return collectionIDs.filter((collectionID) => {
      let collection = collectionsByID().get(collectionID);

      while (collection?.parentID) {
        if (parentIDs.has(collection.parentID)) return false;

        collection = collectionsByID().get(collection.parentID);
      }

      return true;
    });
  };
  const excludeEntriesInCollections = (
    entries: PublishingPanelEntryOccurrence[],
    collectionIDs: string[]
  ) => {
    const selectedIDs = new Set(collectionIDs);

    const entryIDs = entries.flatMap((entry) => {
      let collectionID = entry.treeCollectionID;

      while (collectionID) {
        if (selectedIDs.has(collectionID)) return [];

        collectionID = collectionsByID().get(collectionID)?.parentID ?? null;
      }

      return [entry.entryID];
    });

    return [...new Set(entryIDs)];
  };
  const publishingRoot = () => {
    return props.content.collections.find(({ collectionID }) => {
      return collectionID === props.collectionID;
    });
  };
  const canPublishTree = () => Boolean(publishingRoot()?.canPublish);
  const canUnpublishTree = () => Boolean(publishingRoot()?.canUnpublish);
  const useTreeUnpublishAction = () => {
    return publishingRoot()?.status === "pending-removal" && canUnpublishTree();
  };
  const publishSelection = () => {
    const collectionIDs = topLevelCollectionIDs(publishableCollectionIDs());
    const entryIDs = excludeEntriesInCollections(publishableEntries(), collectionIDs);
    const unpublishCollectionIDs = topLevelCollectionIDs(
      excludeCollectionsInCollections(unpublishableCollectionIDs(), collectionIDs)
    );
    const unpublishEntryIDs = excludeEntriesInCollections(unpublishableEntries(), [
      ...collectionIDs,
      ...unpublishCollectionIDs
    ]);

    if (
      collectionIDs.length > 0 ||
      entryIDs.length > 0 ||
      unpublishCollectionIDs.length > 0 ||
      unpublishEntryIDs.length > 0
    ) {
      props.onAction({
        action: "publish-selection",
        collectionIDs,
        entryIDs,
        unpublishCollectionIDs,
        unpublishEntryIDs
      });
    }
  };
  const unpublishSelection = () => {
    const collectionIDs = topLevelCollectionIDs(unpublishableCollectionIDs());
    const entryIDs = excludeEntriesInCollections(unpublishableEntries(), collectionIDs);

    if (collectionIDs.length > 0 || entryIDs.length > 0) {
      props.onAction({ action: "unpublish-selection", collectionIDs, entryIDs });
    }
  };
  const publishTree = () => {
    props.onAction({ action: "publish-collection", targetCollectionID: props.collectionID });
  };
  const unpublishTree = () => {
    props.onAction({ action: "unpublish-selection", collectionIDs: [props.collectionID] });
  };
  const publishLoading = () => {
    return (
      props.mutationPending &&
      (props.mutationAction === "publish-collection" ||
        props.mutationAction === "publish-selection")
    );
  };
  const unpublishLoading = () => {
    return props.mutationPending && props.mutationAction === "unpublish-selection";
  };
  const revertLoading = () => {
    return props.mutationPending && props.mutationAction === "revert";
  };
  const revertLabel = () => {
    const target = revertTarget();

    if (target.all) return "Revert all pending changes";

    return `Revert ${target.count} selected pending ${target.count === 1 ? "change" : "changes"}`;
  };
  const publishingMenuItems = (): MenuItem[] => {
    if (useDefaultAction()) {
      if (useTreeUnpublishAction()) {
        return [
          {
            disabled: props.mutationPending,
            icon: "i-material-symbols:unpublished-outline-rounded",
            label: "Unpublish",
            onClick: unpublishTree
          }
        ];
      }

      return [
        {
          disabled: !canPublishTree() || props.mutationPending,
          icon: "i-material-symbols:publish-rounded",
          label: "Publish",
          onClick: publishTree
        }
      ];
    }

    if (useTreeUnpublishAction()) {
      return [
        {
          disabled: unpublishableCount() === 0 || props.mutationPending,
          icon: "i-material-symbols:unpublished-outline-rounded",
          label: `Unpublish (${selectedCount()})`,
          onClick: unpublishSelection
        }
      ];
    }

    return [
      {
        disabled: publishableCount() + unpublishableCount() === 0 || props.mutationPending,
        icon: "i-material-symbols:publish-rounded",
        label: `Publish (${selectedCount()})`,
        onClick: publishSelection
      }
    ];
  };
  const menuItems = (): MenuItem[] => {
    const target = revertTarget();

    return [
      ...publishingMenuItems(),
      {
        disabled: !target.canRevert || props.mutationPending,
        icon: "i-lucide:undo-2",
        label: target.all ? "Revert all changes" : `Revert (${target.count})`,
        onClick: () => props.onRevert(target)
      }
    ];
  };

  createEffect(() => props.onMenuItemsChange(menuItems()));
  createEffect(
    on(
      () => props.revertCompleted,
      (completed) => {
        if (completed > 0) setSelection([]);
      },
      { defer: true }
    )
  );
  onCleanup(() => props.onMenuItemsChange([]));

  return (
    <div data-tree-interaction class="my-1 flex h-7 min-w-0 items-center gap-1">
      <Show
        when={!useDefaultAction()}
        fallback={
          <Show
            when={useTreeUnpublishAction()}
            fallback={
              <Button
                class="flex w-full items-center justify-center gap-1"
                color="primary"
                size="small"
                variant="outlined"
                loading={publishLoading()}
                disabled={!canPublishTree() || props.mutationPending}
                onClick={publishTree}
              >
                <div class="h-4.5 w-4.5 i-material-symbols:publish-rounded" />
                <span>Publish</span>
              </Button>
            }
          >
            <Button
              class="flex w-full items-center justify-center gap-1"
              color="primary"
              size="small"
              variant="outlined"
              loading={unpublishLoading()}
              disabled={props.mutationPending}
              onClick={unpublishTree}
            >
              <div class="h-4.5 w-4.5 i-material-symbols:unpublished-outline-rounded" />
              <span>Unpublish</span>
            </Button>
          </Show>
        }
      >
        <Show
          when={useTreeUnpublishAction()}
          fallback={
            <Button
              class="flex w-full items-center justify-center gap-1"
              color="primary"
              size="small"
              variant="outlined"
              loading={publishLoading()}
              disabled={publishableCount() + unpublishableCount() === 0 || props.mutationPending}
              onClick={publishSelection}
            >
              <div class="h-4.5 w-4.5 shrink-0 i-material-symbols:publish-rounded" />
              <span class="truncate">Publish ({selectedCount()})</span>
            </Button>
          }
        >
          <Button
            class="flex w-full items-center justify-center gap-1"
            color="primary"
            size="small"
            variant="outlined"
            loading={unpublishLoading()}
            disabled={unpublishableCount() === 0 || props.mutationPending}
            onClick={unpublishSelection}
          >
            <div class="h-4.5 w-4.5 shrink-0 i-material-symbols:unpublished-outline-rounded" />
            <span class="truncate">Unpublish ({selectedCount()})</span>
          </Button>
        </Show>
      </Show>
      <Tooltip content={revertLabel()} placement="top" fixed wrapperClass="shrink-0">
        <IconButton
          aria-label={revertLabel()}
          color="contrast"
          disabled={!revertTarget().canRevert || props.mutationPending}
          icon="i-lucide:undo-2"
          loading={revertLoading()}
          size="small"
          text="soft"
          variant="outlined"
          onClick={() => props.onRevert(revertTarget())}
        />
      </Tooltip>
    </div>
  );
};

export { PublishingPanelActions };
export type { PublishingPanelActionInput, PublishingPanelMutationAction };
