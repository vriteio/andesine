import { MAX_BULK_ITEMS } from "#backend/lib/api/limits";
import { versionSummaryType } from "#backend/lib/data/entry-version";
import { id, publicID } from "#backend/lib/primitives";
import {
  publishingChannelCodeType,
  publishingChannelNameType
} from "#backend/lib/publishing/channel";
import { PUBLISHED_CHANNEL_CODE } from "#backend/lib/publishing/config";
import * as z from "zod";

const publishingChannelType = z.object({
  code: publishingChannelCodeType.describe("Publishing channel API identifier"),
  name: publishingChannelNameType.describe("Publishing channel label"),
  builtIn: z.boolean().describe("Whether the channel is built in"),
  createdAt: z.iso.datetime().describe("Time when the channel was created"),
  updatedAt: z.iso.datetime().describe("Time when the channel was last updated")
});
const entryPublicationChannelType = publishingChannelType.pick({
  builtIn: true,
  code: true,
  name: true
});
const entryPublicationType = z.object({
  channel: entryPublicationChannelType,
  publishedAt: z.iso.datetime().describe("Time when the version was published"),
  version: versionSummaryType
});
const publishingChannelListItemType = publishingChannelType.extend({
  assignmentCount: z.number().int().min(0).optional()
});
const channelContentStatusType = z.enum([
  "changes",
  "pending-publish",
  "pending-removal",
  "published"
]);
const channelContentEntryType = z.object({
  canPublish: z.boolean().describe("Whether current permissions allow publishing this entry"),
  canRevert: z.boolean().describe("Whether current permissions allow reverting this entry"),
  canUnpublish: z.boolean().describe("Whether current permissions allow unpublishing this entry"),
  collectionID: id().nullable().describe("Current working collection"),
  deleted: z.boolean().describe("Whether the working entry is deleted"),
  entryID: id(),
  name: z.string(),
  publishedAt: z.iso.datetime().nullable(),
  rank: z.string(),
  status: channelContentStatusType,
  treeCollectionID: id().nullable().describe("Collection used to place the entry in the tree"),
  versionID: id().nullable().describe("Version selected by the current snapshot")
});
const channelContentCollectionType = z.object({
  canPublish: z.boolean().describe("Whether current permissions allow publishing this collection"),
  canRevert: z.boolean().describe("Whether current permissions allow reverting this collection"),
  canUnpublish: z
    .boolean()
    .describe("Whether current permissions allow unpublishing this collection"),
  collectionID: id(),
  deleted: z.boolean().describe("Whether the working collection is deleted"),
  name: z.string(),
  parentID: id().nullable(),
  rank: z.string(),
  status: channelContentStatusType
});
const channelContentType = z.object({
  channel: publishingChannelCodeType,
  collections: z.array(channelContentCollectionType),
  entries: z.array(channelContentEntryType),
  snapshotID: publicID("snp")
});
const channelInput = z.object({
  channel: publishingChannelCodeType
    .optional()
    .default(PUBLISHED_CHANNEL_CODE)
    .describe("Publishing channel, defaults to published")
});
const publishingMutationInput = channelInput.extend({
  expectedSnapshotID: publicID("snp")
    .optional()
    .describe("Reject the mutation if the channel no longer points to this reviewed snapshot")
});
const expectedSnapshotsType = z
  .record(publishingChannelCodeType, publicID("snp"))
  .refine((value) => Object.keys(value).length <= MAX_BULK_ITEMS, {
    message: "Too many channel expectations"
  })
  .optional()
  .describe(
    "Optional snapshot checks for supplied channels before changing collection publishing. Omitted channels are not checked."
  );
const publishEntryTargetType = z.object({
  entryID: id().describe("Entry to publish"),
  versionID: id().optional().describe("Existing version to publish")
});
const revertPublishingChangesInputType = channelInput
  .extend({
    all: z.boolean().optional().describe("Whether to revert all pending changes"),
    collectionID: id().describe("Publishing root collection"),
    collectionIDs: z
      .array(id())
      .max(MAX_BULK_ITEMS)
      .optional()
      .describe("Collections whose changes to revert"),
    entryIDs: z
      .array(id())
      .max(MAX_BULK_ITEMS)
      .optional()
      .describe("Entries whose changes to revert"),
    snapshotID: publicID("snp").describe("Snapshot used to review the changes")
  })
  .refine(
    ({ all, collectionIDs, entryIDs }) => {
      const hasSelection = Boolean(collectionIDs?.length || entryIDs?.length);

      return all === true ? !hasSelection : hasSelection;
    },
    { message: "Select all changes or specific items" }
  )
  .refine(
    ({ collectionIDs, entryIDs }) =>
      (collectionIDs?.length || 0) + (entryIDs?.length || 0) <= MAX_BULK_ITEMS,
    { message: `Select at most ${MAX_BULK_ITEMS} items` }
  );
const revertPublishingChangesResultType = z.object({
  affectedEntryIDs: z.array(id()),
  deletedEntryIDs: z.array(id()),
  noOp: z.boolean(),
  restoredEntryIDs: z.array(id()),
  versionedEntryIDs: z.array(id())
});
const publishedEntriesResultType = z.object({
  publishedEntries: z.number().int().min(0).describe("Number of entries published")
});

const unpublishedEntriesResultType = z.object({
  unpublishedEntries: z.number().int().min(0).describe("Number of entries unpublished")
});

export {
  publishingMutationInput,
  expectedSnapshotsType,
  unpublishedEntriesResultType,
  publishedEntriesResultType,
  publishingChannelType,
  entryPublicationChannelType,
  entryPublicationType,
  publishingChannelListItemType,
  channelContentStatusType,
  channelContentEntryType,
  channelContentCollectionType,
  channelContentType,
  channelInput,
  publishEntryTargetType,
  revertPublishingChangesInputType,
  revertPublishingChangesResultType
};
