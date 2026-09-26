import { entryEventType, type EntryEvent } from "@andesine/contracts/events";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [entryEvent: `${string}:entries`]: EntryEvent;
  }
}

const emitEntryEvent: EmitEvent<{
  [workspaceID: string]: EntryEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:entries`, event);
};
const subscribeToEntryEvents: SubscribeToEvent<{
  [workspaceID: string]: EntryEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:entries`, callback, {
    ...options,
    schema: entryEventType
  });
};

export { emitEntryEvent, subscribeToEntryEvents };
