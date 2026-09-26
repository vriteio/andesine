import { versionEventType, type VersionEvent } from "@andesine/contracts/events";
import { type VersionSummary } from "@andesine/contracts/versions";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [versionEvent: `${string}:versions`]: VersionEvent;
  }
}

interface VersionDeletion {
  entryID: string;
  id: string;
}

const VERSION_EVENT_BATCH_SIZE = 100;
const emitVersionEvent: EmitEvent<{
  [workspaceID: string]: VersionEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:versions`, event);
};
const emitVersionDeletionEvents = (
  workspaceID: string,
  versions: VersionDeletion[],
  memberID?: string
): void => {
  for (let index = 0; index < versions.length; index += VERSION_EVENT_BATCH_SIZE) {
    const batch = versions.slice(index, index + VERSION_EVENT_BATCH_SIZE);

    emitVersionEvent(workspaceID, {
      action: "version:delete",
      data: {
        entryIDsByVersionID: Object.fromEntries(
          batch.map((version) => [version.id, version.entryID])
        ),
        ids: batch.map((version) => version.id)
      },
      memberID
    });
  }
};
const emitVersionCreationEvents = (
  workspaceID: string,
  versions: VersionSummary[],
  memberID?: string
): void => {
  for (const version of versions) {
    emitVersionEvent(workspaceID, {
      action: "version:create",
      data: version,
      memberID
    });
  }
};
const subscribeToVersionEvents: SubscribeToEvent<{
  [workspaceID: string]: VersionEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:versions`, callback, {
    ...options,
    schema: versionEventType
  });
};

export {
  emitVersionCreationEvents,
  emitVersionDeletionEvents,
  emitVersionEvent,
  subscribeToVersionEvents
};
export type { VersionDeletion };
