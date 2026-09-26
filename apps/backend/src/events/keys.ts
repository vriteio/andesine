import { keyEventType, type KeyEvent } from "@andesine/contracts/events";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [keyEvent: `${string}:keys`]: KeyEvent;
  }
}

const emitKeyEvent: EmitEvent<{
  [workspaceID: string]: KeyEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:keys`, event);
};
const subscribeToKeyEvents: SubscribeToEvent<{
  [workspaceID: string]: KeyEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:keys`, callback, {
    ...options,
    schema: keyEventType
  });
};

export { emitKeyEvent, subscribeToKeyEvents };
