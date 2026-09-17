import { createAsync, revalidate, useSearchParams } from "@solidjs/router";
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type ParentComponent,
  useContext
} from "solid-js";
import {
  getPublishingEntryOverlayID,
  type PublishingChannel,
  type PublishingCollectionOverlay,
  type PublishingDeletedEntry,
  type PublishingEntryOverlay,
  type PublishingExplorerOverlay,
  type PendingPublishingCollectionOverlay,
  type PendingPublishingEntryOverlay,
  type PublishingStatus,
  publishingChannelContentQuery,
  publishingChannelsQuery,
  publishingExplorerOverlayQuery,
  publishingPublicationsQuery,
  publishingStatusQuery
} from "#web/lib/data";
import { useWorkspace } from "./workspace";
import { type WorkspaceContentOperationsInput } from "./workspace/operations/types";

interface PublishingState {
  enabledCollectionIDs: Set<string>;
  neverPublishedCollectionIDs: Set<string>;
  neverPublishedEntryIDs: Set<string>;
  unpublishedCollectionIDs: Set<string>;
  unpublishedEntryIDs: Set<string>;
}
interface PublishingRevertItems {
  collectionIDs: string[];
  entryIDs: string[];
}
interface WorkspacePublishingOperationsInput extends WorkspaceContentOperationsInput {
  publishing: Accessor<PublishingState | null>;
}
interface PublishingContextValue {
  channel(): string;
  channels(): PublishingChannel[];
  channelsError(): boolean;
  channelsLoading(): boolean;
  entryOverlaysError(): boolean;
  explorerOverlayLoading(): boolean;
  getCollectionOverlay(collectionID: string): PublishingCollectionOverlay | undefined;
  getCollectionUnpublishedCount(collectionID: string): number;
  getCollectionOverlays(): PublishingCollectionOverlay[];
  getCollectionOverlaysInParent(parentID: string | null): PublishingCollectionOverlay[];
  getPendingCollectionOverlay(collectionID: string): PendingPublishingCollectionOverlay | undefined;
  getPendingCollectionOverlaysInParent(
    parentID: string | null
  ): PendingPublishingCollectionOverlay[];
  hasCollectionUnpublishedChanges(collectionID: string): boolean;
  getChannelName(code?: string): string;
  getDeletedEntry(entryID: string): PublishingDeletedEntry | undefined;
  getEntryOverlay(overlayID: string): PublishingEntryOverlay | undefined;
  getEntryOverlayByEntryID(entryID: string): PublishingEntryOverlay | undefined;
  getEntryOverlays(): PublishingEntryOverlay[];
  getEntryOverlaysInCollection(collectionID: string | null): PublishingEntryOverlay[];
  getPendingEntryOverlay(entryID: string): PendingPublishingEntryOverlay | undefined;
  getPendingEntryOverlaysInCollection(collectionID: string | null): PendingPublishingEntryOverlay[];
  getEntryPublishingStatus(entryID: string): ChannelPublishingStatus | null;
  getPublishedEntryRoot(
    entryID: string
  ): PublishingStatus["publishedEntryRoots"][number] | undefined;
  getPublishedCollectionRoot(collectionID: string): string | undefined;
  retry(): void;
  isCollectionNeverPublished(collectionID: string): boolean;
  isCollectionReverting(collectionID: string): boolean;
  isEntryNeverPublished(entryID: string): boolean;
  isEntryReverting(entryID: string): boolean;
  startReverting(items: PublishingRevertItems): void;
  stopReverting(items: PublishingRevertItems): void;
  setChannel(channel: string): void;
  statusError(): boolean;
  statusLoading(): boolean;
}
interface PublishingChannelsResult {
  error?: true;
  result?: PublishingChannel[];
}
interface PublishingExplorerOverlayResult {
  channel: string;
  error?: true;
  result?: PublishingExplorerOverlay;
}

type ChannelPublishingStatus = "error" | "loading" | "outside" | "published" | "unpublished";
type EntryPublishingStatus = "outside" | "published" | "unpublished";

const PUBLISHED_CHANNEL = "published";
const PublishingContext = createContext<PublishingContextValue>();

const PublishingProvider: ParentComponent = (props) => {
  const { content, subscribeToUpdates } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [revertingCollectionCounts, setRevertingCollectionCounts] = createSignal(
    new Map<string, number>()
  );
  const [revertingEntryCounts, setRevertingEntryCounts] = createSignal(new Map<string, number>());
  const channel = () => {
    const value = searchParams.channel;

    return typeof value === "string" ? value : PUBLISHED_CHANNEL;
  };
  const canRead = () => content.hasEntryActionInAnyCollection("entry:read");
  const channelList = createAsync(async (): Promise<PublishingChannelsResult> => {
    if (!canRead() || content.offline()) return { result: [] };

    try {
      return { result: await publishingChannelsQuery() };
    } catch (error) {
      console.error(error);
      return { error: true };
    }
  });
  const customStatus = createAsync(async () => {
    const selectedChannel = channel();

    if (!canRead() || content.offline()) return null;

    return {
      channel: selectedChannel,
      response: await publishingStatusQuery({ channel: selectedChannel })
    };
  });
  const explorerOverlay = createAsync(async (): Promise<PublishingExplorerOverlayResult> => {
    const selectedChannel = channel();

    if (!canRead() || content.offline()) {
      return { channel: selectedChannel, result: { collections: [], entries: [] } };
    }

    try {
      return {
        channel: selectedChannel,
        result: await publishingExplorerOverlayQuery({ channel: selectedChannel })
      };
    } catch (error) {
      console.error(error);
      return { channel: selectedChannel, error: true };
    }
  });
  const channelResult = () => channelList.latest;
  const customStatusResult = () => {
    const latest = customStatus.latest;

    return latest?.channel === channel() ? latest.response : undefined;
  };
  const explorerOverlayResult = () => {
    const latest = explorerOverlay.latest;

    return latest?.channel === channel() ? latest : undefined;
  };
  const getEntryOverlays = () => {
    return (explorerOverlayResult()?.result?.entries || []).filter((overlay) => {
      const entry = content.entries.get({ entryID: overlay.entryID });

      if (!entry) return true;
      if (overlay.reason === "deleted") return false;

      const snapshotCollectionID = overlay.snapshotCollectionID ?? overlay.collectionID;

      return (entry.collectionID ?? null) !== snapshotCollectionID;
    });
  };
  const getPendingEntryOverlays = () => {
    const actualOverlayEntryIDs = new Set(getEntryOverlays().map((overlay) => overlay.entryID));

    return [...content.pendingPublishingEntryOverlays().values()].filter((overlay) => {
      return (
        !content.entries.get({ entryID: overlay.entryID }) &&
        !actualOverlayEntryIDs.has(overlay.entryID) &&
        (!customStatusResult()?.result || publishedEntryRootsByID().has(overlay.entryID))
      );
    });
  };
  const getCollectionOverlays = () => {
    return (explorerOverlayResult()?.result?.collections || []).filter((overlay) => {
      return !content.collections.get({ collectionID: overlay.collectionID });
    });
  };
  const getPendingCollectionOverlays = () => {
    const actualOverlayIDs = new Set(
      getCollectionOverlays().map((overlay) => overlay.collectionID)
    );

    return [...content.pendingPublishingCollectionOverlays().values()].filter((overlay) => {
      return (
        !content.collections.get({ collectionID: overlay.collectionID }) &&
        !actualOverlayIDs.has(overlay.collectionID) &&
        (!customStatusResult()?.result || publishedCollectionRootsByID().has(overlay.collectionID))
      );
    });
  };
  const collectionOverlaysByID = createMemo(() => {
    return new Map(
      getCollectionOverlays().map((collection) => [collection.collectionID, collection])
    );
  });
  const deletedEntries = (): PublishingDeletedEntry[] => {
    return getEntryOverlays().filter(
      (entry): entry is PublishingDeletedEntry => entry.reason === "deleted"
    );
  };
  const publishedEntryRootsByID = createMemo(() => {
    return new Map(
      (customStatusResult()?.result?.publishedEntryRoots || []).map((root) => [root.entryID, root])
    );
  });
  const publishedCollectionRootsByID = createMemo(() => {
    return new Map(
      (customStatusResult()?.result?.publishedCollectionRoots || []).map((root) => [
        root.collectionID,
        root.publishingCollectionID
      ])
    );
  });
  const unpublishedEntryIDs = createMemo(() => {
    const status = customStatusResult()?.result;

    if (status) return new Set(status.unpublishedEntryIDs);

    if (channel() === PUBLISHED_CHANNEL) {
      return content.publishing()?.unpublishedEntryIDs || new Set<string>();
    }

    return new Set<string>();
  });
  const neverPublishedEntryIDs = createMemo(() => {
    const status = customStatusResult()?.result;

    if (status) return new Set(status.neverPublishedEntryIDs);

    if (channel() === PUBLISHED_CHANNEL) {
      return content.publishing()?.neverPublishedEntryIDs || new Set<string>();
    }

    return new Set<string>();
  });
  const unpublishedCollectionIDs = createMemo(() => {
    const status = customStatusResult()?.result;

    if (status) return new Set(status.unpublishedCollectionIDs);

    return content.publishing()?.unpublishedCollectionIDs || new Set<string>();
  });
  const neverPublishedCollectionIDs = createMemo(() => {
    const status = customStatusResult()?.result;

    if (status) return new Set(status.neverPublishedCollectionIDs);

    return content.publishing()?.neverPublishedCollectionIDs || new Set<string>();
  });
  const channels = () => channelResult()?.result || [];
  const channelsLoading = () => canRead() && channelResult() === undefined;
  const channelsError = () => Boolean(channelResult()?.error);
  const entryOverlaysError = () => Boolean(explorerOverlayResult()?.error);
  const explorerOverlayLoading = () => {
    return !content.offline() && canRead() && explorerOverlayResult() === undefined;
  };
  const statusLoading = () => {
    return !content.offline() && canRead() && customStatusResult() === undefined;
  };
  const statusError = () => Boolean(customStatusResult()?.error);
  const getChannelName = (code = channel()) => {
    return channels().find((availableChannel) => availableChannel.code === code)?.name || code;
  };
  const getDeletedEntry = (entryID: string) => {
    return deletedEntries().find((entry) => entry.entryID === entryID);
  };
  const getCollectionOverlay = (collectionID: string) => {
    return collectionOverlaysByID().get(collectionID);
  };
  const getCollectionOverlaysInParent = (parentID: string | null) => {
    return getCollectionOverlays().filter((overlay) => overlay.parentID === parentID);
  };
  const getPendingCollectionOverlay = (collectionID: string) => {
    return getPendingCollectionOverlays().find((overlay) => overlay.collectionID === collectionID);
  };
  const getPendingCollectionOverlaysInParent = (parentID: string | null) => {
    return getPendingCollectionOverlays().filter((overlay) => overlay.parentID === parentID);
  };
  const getPublishedEntryRoot = (entryID: string) => publishedEntryRootsByID().get(entryID);
  const getPublishedCollectionRoot = (collectionID: string) =>
    publishedCollectionRootsByID().get(collectionID);
  const getEntryOverlay = (overlayID: string) => {
    return getEntryOverlays().find((overlay) => getPublishingEntryOverlayID(overlay) === overlayID);
  };
  const getEntryOverlayByEntryID = (entryID: string) => {
    return getEntryOverlays().find((overlay) => overlay.entryID === entryID);
  };
  const getEntryOverlaysInCollection = (collectionID: string | null) => {
    return getEntryOverlays().filter((overlay) => {
      const displayCollectionID =
        overlay.snapshotCollectionID && collectionOverlaysByID().has(overlay.snapshotCollectionID)
          ? overlay.snapshotCollectionID
          : overlay.collectionID;

      return displayCollectionID === collectionID;
    });
  };
  const getPendingEntryOverlay = (entryID: string) => {
    return getPendingEntryOverlays().find((overlay) => overlay.entryID === entryID);
  };
  const getPendingEntryOverlaysInCollection = (collectionID: string | null) => {
    return getPendingEntryOverlays().filter((overlay) => overlay.collectionID === collectionID);
  };
  const setChannel = (nextChannel: string) => {
    setSearchParams(
      { channel: nextChannel === PUBLISHED_CHANNEL ? undefined : nextChannel },
      { replace: true }
    );
  };
  const retry = () => {
    void revalidate(publishingChannelsQuery.key);
    void revalidate(publishingExplorerOverlayQuery.keyFor({ channel: channel() }));

    void revalidate(publishingStatusQuery.keyFor({ channel: channel() }));
  };
  const getEntryPublishingStatus = (entryID: string): ChannelPublishingStatus | null => {
    const baseStatus = content.getEntryPublishingStatus(entryID);

    if (!baseStatus || baseStatus === "outside") {
      return baseStatus;
    }

    if (content.offline() && channel() === PUBLISHED_CHANNEL) return baseStatus;
    if (statusLoading()) return "loading";
    if (statusError()) return "error";

    return unpublishedEntryIDs().has(entryID) ? "unpublished" : "published";
  };
  const getCollectionUnpublishedCount = (collectionID: string) => {
    if (statusLoading() || statusError()) return 0;

    const collections = content.collectionsCollection().find().fetch();
    const collectionsByID = new Map(collections.map((collection) => [collection.id, collection]));
    const changedEntryIDs = new Set<string>();

    for (const entryID of unpublishedEntryIDs()) {
      const entry = content.entriesCollection().findOne({ id: entryID });
      const collection = entry?.collectionID ? collectionsByID.get(entry.collectionID) : undefined;

      if (collection && [collection.id, ...collection.ancestors].includes(collectionID)) {
        changedEntryIDs.add(entryID);
      }
    }

    for (const overlay of getEntryOverlays()) {
      const collection = overlay.collectionID
        ? collectionsByID.get(overlay.collectionID)
        : undefined;

      if (collection && [collection.id, ...collection.ancestors].includes(collectionID)) {
        changedEntryIDs.add(overlay.entryID);
      }
    }

    return changedEntryIDs.size;
  };
  const hasCollectionUnpublishedChanges = (collectionID: string) => {
    return unpublishedCollectionIDs().has(collectionID);
  };
  const isCollectionNeverPublished = (collectionID: string) => {
    return neverPublishedCollectionIDs().has(collectionID);
  };
  const isEntryNeverPublished = (entryID: string) => {
    return neverPublishedEntryIDs().has(entryID);
  };
  const updateRevertingCounts = (
    setter: typeof setRevertingEntryCounts,
    ids: string[],
    change: 1 | -1
  ) => {
    setter((current) => {
      const next = new Map(current);

      for (const id of ids) {
        const count = (next.get(id) ?? 0) + change;

        if (count > 0) next.set(id, count);
        else next.delete(id);
      }

      return next;
    });
  };
  const startReverting = (items: PublishingRevertItems) => {
    updateRevertingCounts(setRevertingCollectionCounts, items.collectionIDs, 1);
    updateRevertingCounts(setRevertingEntryCounts, items.entryIDs, 1);
  };
  const stopReverting = (items: PublishingRevertItems) => {
    updateRevertingCounts(setRevertingCollectionCounts, items.collectionIDs, -1);
    updateRevertingCounts(setRevertingEntryCounts, items.entryIDs, -1);
  };
  const isCollectionReverting = (collectionID: string) => {
    return revertingCollectionCounts().has(collectionID);
  };
  const isEntryReverting = (entryID: string) => {
    return revertingEntryCounts().has(entryID);
  };

  createEffect(() => {
    const result = channelResult();
    const selectedChannel = channel();

    if (
      !result?.result ||
      selectedChannel === PUBLISHED_CHANNEL ||
      result.result.some((availableChannel) => availableChannel.code === selectedChannel)
    ) {
      return;
    }

    setChannel(PUBLISHED_CHANNEL);
  });

  createEffect(() => {
    const result = explorerOverlayResult()?.result;
    const status = customStatusResult()?.result;

    if (!result) return;

    const actualEntryIDs = new Set(result.entries.map((overlay) => overlay.entryID));
    const actualCollectionIDs = new Set(result.collections.map((overlay) => overlay.collectionID));
    const publishedEntryIDs = new Set(
      (status?.publishedEntryRoots ?? []).map((root) => root.entryID)
    );
    const publishedCollectionIDs = new Set(
      (status?.publishedCollectionRoots ?? []).map((root) => root.collectionID)
    );
    const confirmedEntryIDs = [...content.pendingPublishingEntryOverlays().keys()].filter(
      (entryID) => actualEntryIDs.has(entryID) || (status && !publishedEntryIDs.has(entryID))
    );
    const confirmedCollectionIDs = [...content.pendingPublishingCollectionOverlays().keys()].filter(
      (collectionID) =>
        actualCollectionIDs.has(collectionID) ||
        (status && !publishedCollectionIDs.has(collectionID))
    );

    if (confirmedEntryIDs.length > 0) {
      content.removePendingPublishingEntryOverlays(confirmedEntryIDs);
    }

    if (confirmedCollectionIDs.length > 0) {
      content.removePendingPublishingCollectionOverlays(confirmedCollectionIDs);
    }
  });

  const unsubscribeFromUpdates = subscribeToUpdates((event) => {
    const changesWorkingStructure =
      event.action.startsWith("collection:") ||
      event.action === "entry:create" ||
      event.action === "entry:restore" ||
      event.action === "entry:update" ||
      event.action === "entry:move" ||
      event.action === "entry:delete" ||
      event.action === "publishing:collection-update";

    if (changesWorkingStructure) {
      void revalidate(publishingChannelContentQuery.key);
      void revalidate(publishingStatusQuery.keyFor({ channel: channel() }));
    }

    if (
      event.action === "entry:delete" ||
      event.action === "entry:move" ||
      event.action === "entry:restore" ||
      event.action === "collection:move" ||
      event.action === "collection:restore" ||
      event.action === "collection:update" ||
      event.action === "collection:delete"
    ) {
      void revalidate(publishingExplorerOverlayQuery.keyFor({ channel: channel() }));
    }

    if (event.action.startsWith("publishing:channel-")) {
      void revalidate(publishingChannelsQuery.key);
      void revalidate(publishingChannelContentQuery.key);
      void revalidate(publishingExplorerOverlayQuery.keyFor({ channel: channel() }));
      void revalidate(publishingPublicationsQuery.key);

      if (event.action === "publishing:channel-advance" && event.data.channel === channel()) {
        void revalidate(publishingStatusQuery.keyFor({ channel: channel() }));
      }

      return;
    }

    if (event.action === "publishing:entries-content-update") {
      void revalidate(publishingChannelContentQuery.key);

      if (event.data.entries.length > 0) {
        void revalidate(publishingStatusQuery.keyFor({ channel: channel() }));
      }

      return;
    }

    if (event.action === "publishing:entries-update" && event.data.entries.length > 0) {
      void revalidate(publishingChannelContentQuery.key);
      void revalidate(publishingExplorerOverlayQuery.keyFor({ channel: channel() }));
      void revalidate(
        event.data.entries.map((entry) => {
          return publishingPublicationsQuery.keyFor({ entryID: entry.entryID });
        })
      );

      void revalidate(publishingStatusQuery.keyFor({ channel: channel() }));
    }
  });

  onCleanup(unsubscribeFromUpdates);

  return (
    <PublishingContext.Provider
      value={{
        channel,
        channels,
        channelsError,
        channelsLoading,
        entryOverlaysError,
        explorerOverlayLoading,
        getCollectionOverlay,
        getCollectionOverlays,
        getCollectionOverlaysInParent,
        getPendingCollectionOverlay,
        getPendingCollectionOverlaysInParent,
        getCollectionUnpublishedCount,
        getChannelName,
        getDeletedEntry,
        getEntryOverlay,
        getEntryOverlayByEntryID,
        getEntryOverlays,
        getEntryOverlaysInCollection,
        getPendingEntryOverlay,
        getPendingEntryOverlaysInCollection,
        getEntryPublishingStatus,
        getPublishedEntryRoot,
        getPublishedCollectionRoot,
        hasCollectionUnpublishedChanges,
        isCollectionNeverPublished,
        isCollectionReverting,
        isEntryNeverPublished,
        isEntryReverting,
        retry,
        setChannel,
        startReverting,
        statusError,
        statusLoading,
        stopReverting
      }}
    >
      {props.children}
    </PublishingContext.Provider>
  );
};

const createWorkspacePublishingOperations = (input: WorkspacePublishingOperationsInput) => {
  const effectiveCollectionIDs = createMemo(() => {
    const publishing = input.publishing();

    if (!publishing) return null;

    const enabledCollectionIDs = publishing.enabledCollectionIDs;
    const collections = input.collectionsCollection().find().fetch();

    return new Set(
      collections
        .filter((collection) => {
          return [collection.id, ...collection.ancestors].some((collectionID) => {
            return enabledCollectionIDs.has(collectionID);
          });
        })
        .map((collection) => collection.id)
    );
  });
  const collectionUnpublishedCounts = createMemo(() => {
    const publishing = input.publishing();
    const counts = new Map<string, number>();

    if (!publishing) return counts;

    const collections = input.collectionsCollection().find().fetch();
    const collectionsByID = new Map(collections.map((collection) => [collection.id, collection]));
    const entries = input.entriesCollection().find().fetch();

    for (const entry of entries) {
      if (!entry.collectionID || !publishing.unpublishedEntryIDs.has(entry.id)) continue;

      const collection = collectionsByID.get(entry.collectionID);

      if (!collection) continue;

      for (const collectionID of [collection.id, ...collection.ancestors]) {
        counts.set(collectionID, (counts.get(collectionID) ?? 0) + 1);
      }
    }

    return counts;
  });
  const isCollectionPublishingEnabled = (collectionID: string) => {
    return effectiveCollectionIDs()?.has(collectionID) ?? false;
  };
  const isCollectionPublishingRoot = (collectionID: string) => {
    const publishing = input.publishing();
    const collection = input.collectionsCollection().findOne({ id: collectionID });

    if (!publishing || !collection || !publishing.enabledCollectionIDs.has(collectionID)) {
      return false;
    }

    return !collection.ancestors.some((ancestorID) => {
      return publishing.enabledCollectionIDs.has(ancestorID);
    });
  };
  const getCollectionUnpublishedCount = (collectionID: string) => {
    return collectionUnpublishedCounts().get(collectionID) ?? 0;
  };
  const getEntryPublishingStatus = (entryID: string): EntryPublishingStatus | null => {
    const publishing = input.publishing();
    const entry = input.entriesCollection().findOne({ id: entryID });

    if (!publishing || !entry) return null;
    if (!entry.collectionID || !isCollectionPublishingEnabled(entry.collectionID)) return "outside";
    if (publishing.unpublishedEntryIDs.has(entryID)) return "unpublished";

    return "published";
  };

  return {
    getCollectionUnpublishedCount,
    getEntryPublishingStatus,
    isCollectionPublishingEnabled,
    isCollectionPublishingRoot
  };
};
const usePublishing = () => useContext(PublishingContext)!;

export { createWorkspacePublishingOperations, PublishingProvider, usePublishing };
export type { ChannelPublishingStatus, EntryPublishingStatus, PublishingState };
