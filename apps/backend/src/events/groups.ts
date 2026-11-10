import { groupEventType, type GroupEvent } from "@andesine/contracts/events";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [groupEvent: `${string}:groups`]: GroupEvent;
  }
}

const emitGroupEvent: EmitEvent<{
  [workspaceID: string]: GroupEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:groups`, event);
};
const subscribeToGroupEvents: SubscribeToEvent<{
  [workspaceID: string]: GroupEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:groups`, callback, {
    ...options,
    schema: groupEventType
  });
};

export { emitGroupEvent, subscribeToGroupEvents };
