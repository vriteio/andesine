import { revalidate, useParams, useSearchParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { createContext, createSignal, type ParentComponent, useContext } from "solid-js";
import { useTree } from "#web/components/tree";
import { useNotify } from "#web/context/notifications";
import { usePublishing } from "#web/context/publishing";
import { useWorkspace } from "#web/context/workspace";
import { client } from "#web/lib/api";
import {
  publishingChannelContentQuery,
  publishingExplorerOverlayQuery,
  publishingPublicationsQuery,
  publishingStatusQuery
} from "#web/lib/data";
import { createPublishingPanelEntryOccurrences } from "../../publishing/entries";
import { createPublishingRevertTarget } from "../../publishing/revert";
import { usePublishingRevert } from "../../publishing/use-publishing-revert";

interface PublishingTarget {
  ids: string[];
  type: "collection" | "entry";
}
interface PublishingMutationInput {
  action: PublishingAction;
  channel: string;
  target: PublishingTarget;
}
interface PublishingActionsContextValue {
  canRevert(target: PublishingTarget): boolean;
  hasPendingChanges(target: PublishingTarget): boolean;
  open(action: PublishingAction, target: PublishingTarget, channel?: string): void;
  openRevert(target: PublishingTarget): Promise<void>;
  revertPending(): boolean;
}

type PublishingAction = "disable" | "enable" | "publish" | "unpublish";
const ACTION_ERROR_LABELS: Record<PublishingAction, string> = {
  disable: "Failed to disable publishing",
  enable: "Failed to enable publishing",
  publish: "Failed to publish content",
  unpublish: "Failed to unpublish content"
};
const PublishingActionsContext = createContext<PublishingActionsContextValue>();
const PublishingActionsProvider: ParentComponent = (props) => {
  const notify = useNotify();
  const params = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const { content } = useWorkspace();
  const publishing = usePublishing();
  const [, { setSelection }] = useTree();
  const [revertPreparing, setRevertPreparing] = createSignal(false);
  const revert = usePublishingRevert({
    currentEntryID: () => params.slug || "",
    snapshotView: () => Boolean(searchParams.snapshotID),
    onCompleted: () => setSelection([])
  });
  const getWorkingCollectionRoot = (collectionID: string | null) => {
    const collection = collectionID ? content.collections.get({ collectionID }) : undefined;

    if (!collection) return null;

    return (
      [...collection.ancestors, collection.id].find((id) => {
        return content.isCollectionPublishingRoot(id);
      }) || null
    );
  };
  const getTargetRoot = (id: string, type: PublishingTarget["type"]) => {
    if (type === "collection") {
      const collection = content.collections.get({ collectionID: id });

      return (
        (collection && getWorkingCollectionRoot(collection.id)) ||
        publishing.getPublishedCollectionRoot(id) ||
        publishing.getCollectionOverlay(id)?.publishingCollectionID ||
        null
      );
    }

    const entry = content.entries.get({ entryID: id });

    if (entry) {
      return (
        getWorkingCollectionRoot(entry.collectionID || null) ||
        publishing.getPublishedEntryRoot(entry.id)?.collectionID ||
        null
      );
    }

    return publishing.getEntryOverlay(id)?.publishingCollectionID || null;
  };
  const getTargetRoots = (target: PublishingTarget) => {
    return new Set(target.ids.map((id) => getTargetRoot(id, target.type)).filter(Boolean));
  };
  const hasPendingCollectionSubtree = (collectionID: string) => {
    const collections = content.collectionsCollection().find().fetch();
    const subtreeIDs = new Set(
      collections
        .filter((collection) => {
          return collection.id === collectionID || collection.ancestors.includes(collectionID);
        })
        .map(({ id }) => id)
    );
    const collectionOverlays = publishing.getCollectionOverlays();
    let previousSize = -1;

    subtreeIDs.add(collectionID);
    while (previousSize !== subtreeIDs.size) {
      previousSize = subtreeIDs.size;
      for (const overlay of collectionOverlays) {
        if (overlay.parentID && subtreeIDs.has(overlay.parentID)) {
          subtreeIDs.add(overlay.collectionID);
        }
      }
    }

    if (collectionOverlays.some(({ collectionID: id }) => subtreeIDs.has(id))) return true;

    if (
      [...subtreeIDs].some((id) => {
        return (
          publishing.hasCollectionUnpublishedChanges(id) ||
          publishing.getCollectionUnpublishedCount(id) > 0
        );
      })
    ) {
      return true;
    }

    return publishing.getEntryOverlays().some((overlay) => {
      return Boolean(
        (overlay.collectionID && subtreeIDs.has(overlay.collectionID)) ||
        (overlay.snapshotCollectionID && subtreeIDs.has(overlay.snapshotCollectionID))
      );
    });
  };
  const isPendingTarget = (id: string, type: PublishingTarget["type"]) => {
    if (type === "collection") {
      return hasPendingCollectionSubtree(id);
    }

    if (publishing.getEntryOverlay(id)) return true;

    return publishing.getEntryPublishingStatus(id) === "unpublished";
  };
  const hasPendingChanges = (target: PublishingTarget) => {
    if (publishing.statusLoading() || publishing.statusError()) return false;

    return target.ids.some((id) => isPendingTarget(id, target.type));
  };
  const canRevert = (target: PublishingTarget) => {
    if (
      content.offline() ||
      content.syncing() ||
      publishing.statusLoading() ||
      publishing.statusError()
    ) {
      return false;
    }

    return (
      target.ids.length > 0 &&
      getTargetRoots(target).size === 1 &&
      target.ids.every((id) => isPendingTarget(id, target.type))
    );
  };
  const getLogicalEntryIDs = (target: PublishingTarget) => {
    return target.ids.flatMap((id) => {
      const entry = content.entries.get({ entryID: id });

      if (entry) return [entry.id];

      const overlay = publishing.getEntryOverlay(id);

      return overlay ? [overlay.entryID] : [];
    });
  };
  const getRevertSelection = (
    target: PublishingTarget,
    channelContent: Awaited<ReturnType<typeof publishingChannelContentQuery>>,
    collectionID: string
  ) => {
    const occurrences = createPublishingPanelEntryOccurrences({
      collectionID,
      content: channelContent,
      overlays: publishing.getEntryOverlays()
    });

    if (target.type === "entry") {
      const entryIDs = new Set(getLogicalEntryIDs(target));

      return {
        occurrences,
        selection: occurrences.filter(({ entryID }) => entryIDs.has(entryID)).map(({ id }) => id)
      };
    }

    const selectedCollectionIDs = new Set(target.ids);
    let previousSize = -1;

    while (previousSize !== selectedCollectionIDs.size) {
      previousSize = selectedCollectionIDs.size;
      for (const collection of channelContent.collections) {
        if (collection.parentID && selectedCollectionIDs.has(collection.parentID)) {
          selectedCollectionIDs.add(collection.collectionID);
        }
      }
    }

    return {
      occurrences,
      selection: [
        ...channelContent.collections
          .filter(({ collectionID: id }) => selectedCollectionIDs.has(id))
          .map(({ collectionID: id }) => id),
        ...occurrences
          .filter(({ treeCollectionID }) => {
            return Boolean(treeCollectionID && selectedCollectionIDs.has(treeCollectionID));
          })
          .map(({ id }) => id)
      ]
    };
  };
  const openRevert = async (target: PublishingTarget) => {
    const collectionID = [...getTargetRoots(target)][0];
    const channel = publishing.channel();

    if (!collectionID || !canRevert(target) || revertPreparing() || revert.isPending()) return;

    setRevertPreparing(true);
    try {
      const channelContent = await publishingChannelContentQuery({ channel, collectionID });
      const { occurrences, selection } = getRevertSelection(target, channelContent, collectionID);
      const revertTarget = createPublishingRevertTarget({
        all: false,
        content: channelContent,
        entries: occurrences,
        selection
      });

      if (revertTarget.count === 0) {
        notify({ type: "info", text: "No pending changes to revert" });
        return;
      }

      if (!revertTarget.canRevert) {
        notify({ type: "error", text: "You cannot revert these pending changes" });
        return;
      }

      revert.run(revertTarget, {
        channel,
        collectionID,
        snapshotID: channelContent.snapshotID
      });
    } catch (error) {
      console.error(error);
      notify({ type: "error", text: "Failed to load pending changes" });
    } finally {
      setRevertPreparing(false);
    }
  };
  const mutation = createMutation(() => ({
    mutationFn: async (input: PublishingMutationInput) => {
      const ids = input.target.ids;

      if (input.target.type === "entry") {
        if (input.action === "publish") {
          if (ids.length === 1) {
            await client.publishing.publishEntry({ entryID: ids[0], channel: input.channel });
          } else {
            await client.publishing.bulkPublishEntries({
              entries: ids.map((entryID) => ({ entryID })),
              channel: input.channel
            });
          }
          return;
        }

        if (ids.length === 1) {
          await client.publishing.unpublishEntry({ entryID: ids[0], channel: input.channel });
        } else {
          await client.publishing.bulkUnpublishEntries({ ids, channel: input.channel });
        }
        return;
      }

      if (input.action === "enable" || input.action === "disable") {
        const collectionInput = {
          enabled: input.action === "enable",
          publish: input.action === "enable" ? false : undefined
        };

        if (ids.length === 1) {
          await client.publishing.setCollection({ collectionID: ids[0], ...collectionInput });
        } else {
          await client.publishing.bulkSetCollections({ ids, ...collectionInput });
        }
        return;
      }

      if (input.action === "publish") {
        if (ids.length === 1) {
          await client.publishing.publishCollection({
            collectionID: ids[0],
            channel: input.channel
          });
        } else {
          await client.publishing.bulkPublishCollections({ ids, channel: input.channel });
        }
        return;
      }

      if (ids.length === 1) {
        await client.publishing.unpublishCollection({
          collectionID: ids[0],
          channel: input.channel
        });
      } else {
        await client.publishing.bulkUnpublishCollections({ ids, channel: input.channel });
      }
    },
    onSuccess: (_, input) => {
      void revalidate(publishingExplorerOverlayQuery.keyFor({ channel: input.channel }));
      void revalidate(publishingPublicationsQuery.key);
      void revalidate(publishingStatusQuery.key);
    },
    onError: (error, input) => {
      console.error(error);
      notify({ type: "error", text: ACTION_ERROR_LABELS[input.action] });
    }
  }));
  const open = (
    action: PublishingAction,
    target: PublishingTarget,
    channel = publishing.channel()
  ) => {
    if (!mutation.isPending) mutation.mutate({ action, channel, target });
  };
  return (
    <PublishingActionsContext.Provider
      value={{
        canRevert,
        hasPendingChanges,
        open,
        openRevert,
        revertPending: () => revertPreparing() || revert.isPending()
      }}
    >
      {props.children}
    </PublishingActionsContext.Provider>
  );
};

const usePublishingActions = () => useContext(PublishingActionsContext)!;

export { PublishingActionsProvider, usePublishingActions };
export type { PublishingAction, PublishingTarget };
