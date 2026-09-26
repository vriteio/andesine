import {
  type publishingEntryStatusType,
  type publishingEntryContentUpdateType,
  publishingEventType,
  type PublishingEvent
} from "@andesine/contracts/events";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";
import type * as z from "zod";

interface EmitPublishingSnapshotAdvanceInput {
  channel: string;
  collectionIDs: string[];
  entryIDs: string[];
  memberID?: string;
  previousSnapshotID: string;
  snapshotID: string;
  workspaceID: string;
}

declare module "#backend/lib/messaging/events" {
  interface Events {
    [publishingEvent: `${string}:publishing`]: PublishingEvent;
  }
}

const PUBLISHING_EVENT_BATCH_SIZE = 100;
const emitPublishingEvent: EmitEvent<{
  [workspaceID: string]: PublishingEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:publishing`, event);
};
const emitPublishingEntryUpdates = (input: {
  workspaceID: string;
  entries: Array<z.infer<typeof publishingEntryStatusType>>;
  memberID?: string;
  channel?: string;
}): void => {
  const channel = input.channel || "published";

  for (let index = 0; index < input.entries.length; index += PUBLISHING_EVENT_BATCH_SIZE) {
    emitPublishingEvent(input.workspaceID, {
      action: "publishing:entries-update",
      memberID: input.memberID,
      data: {
        channel,
        entries: input.entries.slice(index, index + PUBLISHING_EVENT_BATCH_SIZE)
      }
    });
  }
};
const emitPublishingEntryContentUpdates = (input: {
  workspaceID: string;
  entries: Array<z.infer<typeof publishingEntryContentUpdateType>>;
}): void => {
  for (let index = 0; index < input.entries.length; index += PUBLISHING_EVENT_BATCH_SIZE) {
    emitPublishingEvent(input.workspaceID, {
      action: "publishing:entries-content-update",
      data: { entries: input.entries.slice(index, index + PUBLISHING_EVENT_BATCH_SIZE) }
    });
  }
};
const emitPublishingSnapshotAdvance = (input: EmitPublishingSnapshotAdvanceInput): void => {
  emitPublishingEvent(input.workspaceID, {
    action: "publishing:channel-advance",
    memberID: input.memberID,
    data: {
      channel: input.channel,
      collectionIDs: input.collectionIDs,
      entryIDs: input.entryIDs,
      previousSnapshotID: input.previousSnapshotID,
      snapshotID: input.snapshotID
    }
  });
};
const subscribeToPublishingEvents: SubscribeToEvent<{
  [workspaceID: string]: PublishingEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:publishing`, callback, {
    ...options,
    schema: publishingEventType
  });
};

export {
  emitPublishingEntryContentUpdates,
  emitPublishingEntryUpdates,
  emitPublishingEvent,
  emitPublishingSnapshotAdvance,
  subscribeToPublishingEvents
};
