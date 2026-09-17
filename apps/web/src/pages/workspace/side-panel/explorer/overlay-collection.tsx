import {
  type Card,
  DropdownArea,
  DropdownMenu,
  IconButton,
  type MenuItem,
  Spinner,
  Tooltip
} from "@andesine/components";
import { TreeItem, TreeLevel, type TreeMap, useTree } from "#web/components/tree";
import { usePublishing } from "#web/context/publishing";
import {
  type PendingPublishingCollectionOverlay,
  type PublishingCollectionOverlay
} from "#web/lib/data";
import clsx from "clsx";
import {
  type Component,
  type ComponentProps,
  createEffect,
  createMemo,
  createSignal,
  on,
  Show
} from "solid-js";
import { EXPLORER_GESTURE_PROPS } from "./explorer-dnd";
import { OverlayEntry } from "./overlay-entry";
import { usePublishingActions } from "./publishing-actions";
import { sortExplorerCollectionIDs } from "./sort-collections";
import { sortExplorerEntryIDs } from "./sort-entries";

interface OverlayCollectionProps {
  collection: OverlayCollectionData;
  topLevel?: boolean;
}

type OverlayCollectionData = PendingPublishingCollectionOverlay | PublishingCollectionOverlay;

const OverlayCollection: Component<OverlayCollectionProps> = (props) => {
  const publishing = usePublishing();
  const publishingActions = usePublishingActions();
  const [{ isExpanded, isSelected, selection }, { setSelection, toggleExpanded }] = useTree();
  const [menuOpened, setMenuOpened] = createSignal(false);
  const confirmedCollection = () => {
    return "snapshotID" in props.collection ? props.collection : undefined;
  };
  const loading = () => {
    return (
      !confirmedCollection() || publishing.isCollectionReverting(props.collection.collectionID)
    );
  };
  const childCollections = () => {
    return publishing.getCollectionOverlaysInParent(props.collection.collectionID);
  };
  const pendingChildCollections = () => {
    return publishing.getPendingCollectionOverlaysInParent(props.collection.collectionID);
  };
  const childEntries = () => {
    return publishing.getEntryOverlaysInCollection(props.collection.collectionID);
  };
  const pendingChildEntries = () => {
    return publishing.getPendingEntryOverlaysInCollection(props.collection.collectionID);
  };
  const treeMap = createMemo<TreeMap>(() => {
    return {
      [props.collection.collectionID]: {
        items: sortExplorerEntryIDs({
          entryOverlays: childEntries(),
          pendingEntryOverlays: pendingChildEntries(),
          workingEntries: []
        }),
        levels: sortExplorerCollectionIDs({
          collectionOverlays: childCollections(),
          pendingCollectionOverlays: pendingChildCollections(),
          workingCollectionIDs: []
        })
      }
    };
  });
  const dropdownOptions = (): MenuItem[][] => {
    const collection = confirmedCollection();
    const options: MenuItem[] = [];
    const revertTarget = {
      ids: [props.collection.collectionID],
      type: "collection" as const
    };

    if (!collection) return [];

    if (publishingActions.canRevert(revertTarget)) {
      options.push({
        label: "Revert pending changes",
        icon: "i-lucide:undo-2",
        disabled: publishingActions.revertPending(),
        onClick: () => publishingActions.openRevert(revertTarget)
      });
    }

    if (collection.canUnpublish) {
      options.push({
        label: "Unpublish",
        icon: "i-material-symbols:unpublished-outline-rounded",
        onClick: () => {
          publishingActions.open(
            "unpublish",
            { ids: [collection.collectionID], type: "collection" },
            collection.channel
          );
        }
      });
    }

    return options.length > 0 ? [options] : [];
  };

  createEffect(
    on(menuOpened, (opened) => {
      if (!opened || selection().includes(props.collection.collectionID)) return;

      setSelection([props.collection.collectionID]);
    })
  );

  return (
    <DropdownArea {...EXPLORER_GESTURE_PROPS}>
      <div
        class="relative w-full"
        data-collection={props.collection.collectionID}
        data-explorer-item
      >
        <TreeItem
          class="!overflow-visible"
          id={props.collection.collectionID}
          label={props.collection.name}
          topLevel={props.topLevel}
          selectable
          keyboardMenu={dropdownOptions().flat()}
          onClick={() => toggleExpanded(props.collection.collectionID)}
          onOpenMenu={() => {
            if (!loading()) setMenuOpened(true);
          }}
          icon={
            <div class="relative flex h-full w-full items-center justify-center">
              <div
                class={clsx(
                  "h-full w-full text-gray-400",
                  isSelected(props.collection.collectionID) && "bg-gradient-to-tr",
                  isExpanded(props.collection.collectionID)
                    ? "i-material-symbols:folder-open-rounded"
                    : "i-material-symbols:folder-rounded"
                )}
              />
              <Tooltip
                content="Pending removal"
                placement="right"
                fixed
                wrapperClass="absolute -top-0.5 -left-0.5 h-3 w-3"
              >
                <div class="flex h-3 w-3 items-center justify-center rounded-lg bg-gray-100/80">
                  <div class="flex h-2.5 w-2.5 items-center justify-center text-red-500 i-lucide:radio" />
                </div>
              </Tooltip>
            </div>
          }
          renderLabel={(label) => <span class="flex min-w-0 flex-1 line-through">{label}</span>}
          actions={
            <Show
              when={!loading()}
              fallback={
                <div class="flex h-7 w-7 items-center justify-center">
                  <Spinner class="h-4 w-4" color="primary" />
                </div>
              }
            >
              <Show when={dropdownOptions().length > 0}>
                <DropdownMenu
                  title={props.collection.name}
                  cardProps={
                    {
                      "class": "w-52",
                      "data-tree-interaction": ""
                    } as Partial<ComponentProps<typeof Card>>
                  }
                  items={dropdownOptions()}
                  opened={menuOpened()}
                  mobileSheetDragFromContent={false}
                  portal={false}
                  setOpened={setMenuOpened}
                  onClick={(event) => event.stopPropagation()}
                  trigger={() => (
                    <Show when={selection().length <= 1} fallback={<div />}>
                      <div
                        class={clsx(
                          "shrink-0",
                          !menuOpened() &&
                            "opacity-20 media-mouse:hidden media-mouse:group-hover:flex media-mouse:group-hover:opacity-100"
                        )}
                      >
                        <IconButton
                          data-collection-menu-trigger
                          icon="i-lucide:ellipsis-vertical"
                          size="small"
                          variant="text"
                          text="soft"
                        />
                      </div>
                    </Show>
                  )}
                />
              </Show>
            </Show>
          }
        />
        <TreeLevel
          levelID={props.collection.collectionID}
          tree={treeMap}
          emptyMessage="Collection empty"
          renderLevel={(collectionID) => {
            const collection = () => {
              return (
                publishing.getCollectionOverlay(collectionID) ??
                publishing.getPendingCollectionOverlay(collectionID)
              );
            };

            return (
              <Show when={collection()}>
                {(currentCollection) => <OverlayCollection collection={currentCollection()} />}
              </Show>
            );
          }}
          renderItem={(entryID) => {
            const entry = () => {
              return (
                publishing.getEntryOverlay(entryID) ?? publishing.getPendingEntryOverlay(entryID)
              );
            };

            return (
              <Show when={entry()}>
                {(currentEntry) => <OverlayEntry entry={currentEntry()} />}
              </Show>
            );
          }}
        />
      </div>
    </DropdownArea>
  );
};

export { OverlayCollection };
export type { OverlayCollectionProps };
