import { collectionEventType, type CollectionEvent } from "@andesine/contracts/events";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [collectionEvent: `${string}:collections`]: CollectionEvent;
  }
}

const emitCollectionEvent: EmitEvent<{
  [workspaceID: string]: CollectionEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:collections`, event);
};
const subscribeToCollectionEvents: SubscribeToEvent<{
  [workspaceID: string]: CollectionEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:collections`, callback, {
    ...options,
    schema: collectionEventType
  });
};

export { emitCollectionEvent, subscribeToCollectionEvents };
