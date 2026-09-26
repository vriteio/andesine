import { publishingChannelCodeType, publishingChannelNameType } from "../publishing/channel";
import { id, publicID } from "../primitives/id";
import * as z from "zod";

const publishingEntryStatusType = z.object({
  entryID: id(),
  hasUnpublishedChanges: z.boolean(),
  versionID: id().nullable()
});
const publishingEntryContentUpdateType = z.object({
  entryID: id(),
  matchesPublishedVersion: z.boolean()
});
const publishingEventType = z.union([
  z.object({
    action: z.literal("publishing:collection-update"),
    memberID: id().optional(),
    data: z.object({
      id: id(),
      enabled: z.boolean()
    })
  }),
  z.object({
    action: z.literal("publishing:entries-update"),
    memberID: id().optional(),
    data: z.object({
      channel: publishingChannelCodeType,
      entries: z.array(publishingEntryStatusType)
    })
  }),
  z.object({
    action: z.literal("publishing:entries-content-update"),
    data: z.object({ entries: z.array(publishingEntryContentUpdateType) })
  }),
  z.object({
    action: z.literal("publishing:channel-advance"),
    memberID: id().optional(),
    data: z.object({
      channel: publishingChannelCodeType,
      collectionIDs: z.array(id()),
      entryIDs: z.array(id()),
      previousSnapshotID: publicID("snp"),
      snapshotID: publicID("snp")
    })
  }),
  z.object({
    action: z.literal("publishing:channel-create"),
    memberID: id().optional(),
    data: z.object({
      code: publishingChannelCodeType,
      name: publishingChannelNameType,
      builtIn: z.boolean(),
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime()
    })
  }),
  z.object({
    action: z.literal("publishing:channel-delete"),
    memberID: id().optional(),
    data: z.object({ code: publishingChannelCodeType })
  })
]);
type PublishingEvent = z.infer<typeof publishingEventType>;
export { publishingEventType };
export type { PublishingEvent };

export { publishingEntryStatusType, publishingEntryContentUpdateType };
