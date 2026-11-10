import { query } from "@solidjs/router";
import { client } from "#web/lib/api";

interface PublishingPublicationsQueryInput {
  entryID: string;
}
interface PublishingChannelContentQueryInput {
  channel: string;
  collectionID: string;
}
interface PublishingExplorerOverlayQueryInput {
  channel: string;
}
interface PublishingStatusQueryInput {
  channel: string;
}
interface PublishingStatusResponse {
  error?: true;
  result?: PublishingStatus;
}
interface PublishingEntryOverlayIdentity {
  entryID: string;
  reason?: "deleted" | "moved";
  snapshotID?: string;
}
interface PendingPublishingEntryOverlay {
  collectionID: string | null;
  entryID: string;
  name: string;
  order: string;
  reason: "deleted";
}
interface PendingPublishingCollectionOverlay {
  collectionID: string;
  index: number;
  name: string;
  parentID: string | null;
}

type PublishingPublication = Awaited<
  ReturnType<typeof client.publishing.listEntryPublications>
>[number];
type PublishingChannel = Awaited<ReturnType<typeof client.publishing.listChannels>>[number];
type PublishingChannelContent = Awaited<ReturnType<typeof client.publishing.getChannelContent>>;
type PublishingChannelContentCollection = PublishingChannelContent["collections"][number];
type PublishingChannelContentEntry = PublishingChannelContent["entries"][number];
type PublishingExplorerOverlay = Awaited<ReturnType<typeof client.sync.getExplorerOverlay>>;
type PublishingCollectionOverlay = PublishingExplorerOverlay["collections"][number];
type PublishingEntryOverlay = PublishingExplorerOverlay["entries"][number];
type PublishingDeletedEntry = PublishingEntryOverlay & { reason: "deleted" };
type PublishingStatus = Awaited<ReturnType<typeof client.sync.getPublishingStatus>>;

const publishingChannelContentQuery = query((input: PublishingChannelContentQueryInput) => {
  return client.publishing.getChannelContent(input);
}, "publishing-channel-content");
const publishingExplorerOverlayQuery = query((input: PublishingExplorerOverlayQueryInput) => {
  return client.sync.getExplorerOverlay(input);
}, "publishing-explorer-overlay");
const publishingPublicationsQuery = query(
  (input: PublishingPublicationsQueryInput) => client.publishing.listEntryPublications(input),
  "publishing-publications"
);
const publishingChannelsQuery = query(
  () => client.publishing.listChannels({}),
  "publishing-channels"
);
const publishingChannelsWithUsageQuery = query(
  () => client.publishing.listChannels({ includeAssignmentCount: true }),
  "publishing-channels-with-usage"
);
const publishingStatusQuery = query(
  async (input: PublishingStatusQueryInput): Promise<PublishingStatusResponse> => {
    try {
      return { result: await client.sync.getPublishingStatus(input) };
    } catch (error) {
      console.error(error);
      return { error: true };
    }
  },
  "publishing-status"
);
const getPublishingEntryOverlayID = (overlay: PublishingEntryOverlayIdentity): string => {
  if (overlay.reason === "deleted") return overlay.entryID;

  return `publishing-overlay:${overlay.snapshotID}:${overlay.entryID}`;
};

export {
  getPublishingEntryOverlayID,
  publishingChannelContentQuery,
  publishingChannelsQuery,
  publishingChannelsWithUsageQuery,
  publishingExplorerOverlayQuery,
  publishingPublicationsQuery,
  publishingStatusQuery
};
export type {
  PublishingChannelContent,
  PublishingChannelContentCollection,
  PublishingChannelContentEntry,
  PublishingChannelContentQueryInput,
  PublishingCollectionOverlay,
  PublishingDeletedEntry,
  PublishingEntryOverlay,
  PendingPublishingCollectionOverlay,
  PendingPublishingEntryOverlay,
  PublishingExplorerOverlay,
  PublishingExplorerOverlayQueryInput,
  PublishingPublication,
  PublishingPublicationsQueryInput,
  PublishingChannel,
  PublishingStatus,
  PublishingStatusQueryInput,
  PublishingStatusResponse
};
