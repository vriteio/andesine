import { createAsync } from "@solidjs/router";
import { createMemo } from "solid-js";
import { usePublishing } from "#web/context/publishing";
import { useWorkspace } from "#web/context/workspace";
import { type PublishingChannelContent, publishingChannelContentQuery } from "#web/lib/data";
import { createPublishingPanelEntryOccurrences } from "./entries";
import { createPublishingRevertTarget } from "./revert";
import { usePublishingRevert } from "./use-publishing-revert";

interface EntryPublishingRevertResult {
  channel: string;
  collectionID: string;
  error?: true;
  result?: PublishingChannelContent;
}
interface UseEntryPublishingRevertInput {
  entryID(): string;
  onCompleted(): void;
  onOpen(): void;
}

const useEntryPublishingRevert = (props: UseEntryPublishingRevertInput) => {
  const { content } = useWorkspace();
  const publishing = usePublishing();
  const revert = usePublishingRevert({
    currentEntryID: props.entryID,
    snapshotView: () => false,
    onCompleted: props.onCompleted
  });
  const collectionID = createMemo(() => {
    const entry = content.entries.get({ entryID: props.entryID() });
    const collection = entry?.collectionID
      ? content.collections.get({ collectionID: entry.collectionID })
      : null;
    const workingRoot = collection
      ? [...collection.ancestors, collection.id].find((id) => {
          return content.isCollectionPublishingRoot(id);
        })
      : undefined;

    return workingRoot || publishing.getPublishedEntryRoot(props.entryID())?.collectionID || null;
  });
  const channelContent = createAsync(
    async (): Promise<EntryPublishingRevertResult | null> => {
      const channel = publishing.channel();
      const currentCollectionID = collectionID();

      if (!currentCollectionID || content.offline()) return null;

      try {
        return {
          channel,
          collectionID: currentCollectionID,
          result: await publishingChannelContentQuery({
            channel,
            collectionID: currentCollectionID
          })
        };
      } catch (error) {
        console.error(error);
        return { channel, collectionID: currentCollectionID, error: true };
      }
    },
    { deferStream: true, initialValue: null }
  );
  const response = () => {
    const channel = publishing.channel();
    const currentCollectionID = collectionID();
    const latest = channelContent.latest;

    if (
      !currentCollectionID ||
      latest?.channel !== channel ||
      latest.collectionID !== currentCollectionID
    ) {
      return undefined;
    }

    return latest;
  };
  const entry = () => {
    return response()?.result?.entries.find(({ entryID }) => entryID === props.entryID());
  };
  const target = createMemo(() => {
    const currentResponse = response();
    const currentEntry = entry();

    if (!currentResponse?.result || !currentEntry || currentEntry.status === "published") {
      return null;
    }

    const entries = createPublishingPanelEntryOccurrences({
      collectionID: currentResponse.collectionID,
      content: currentResponse.result,
      overlays: publishing.getEntryOverlays()
    });
    const selection = entries
      .filter(({ entryID }) => entryID === props.entryID())
      .map(({ id }) => id);
    const currentTarget = createPublishingRevertTarget({
      all: false,
      content: currentResponse.result,
      entries,
      selection
    });

    return currentTarget.count > 0 ? currentTarget : null;
  });
  const open = () => {
    const currentResponse = response();
    const currentTarget = target();

    if (!currentResponse?.result || !currentTarget?.canRevert || revert.isPending()) return;

    props.onOpen();
    revert.run(currentTarget, {
      channel: currentResponse.channel,
      collectionID: currentResponse.collectionID,
      snapshotID: currentResponse.result.snapshotID
    });
  };
  const status = () => {
    const currentResponse = response();
    const currentEntry = entry();

    if (!currentResponse) return "loading" as const;
    if (currentResponse.error) return "error" as const;
    if (!currentEntry) return "outside" as const;

    return currentEntry.status === "published" ? ("published" as const) : ("unpublished" as const);
  };

  return {
    available: () => Boolean(target()?.canRevert),
    collectionID,
    isPending: revert.isPending,
    open,
    status
  };
};

export { useEntryPublishingRevert };
