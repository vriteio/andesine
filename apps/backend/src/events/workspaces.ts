import { workspaceStateEventType, type WorkspaceStateEvent } from "@andesine/contracts/events";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [workspaceStateEvent: `${string}:workspace`]: WorkspaceStateEvent;
  }
}

const emitWorkspaceStateEvent: EmitEvent<{
  [workspaceID: string]: WorkspaceStateEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:workspace`, event);
};
const subscribeToWorkspaceStateEvents: SubscribeToEvent<{
  [workspaceID: string]: WorkspaceStateEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:workspace`, callback, {
    ...options,
    schema: workspaceStateEventType
  });
};

export { emitWorkspaceStateEvent, subscribeToWorkspaceStateEvents };
