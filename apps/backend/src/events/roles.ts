import { roleEventType, type RoleEvent } from "@andesine/contracts/events";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [roleEvent: `${string}:roles`]: RoleEvent;
  }
}

const emitRoleEvent: EmitEvent<{
  [workspaceID: string]: RoleEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:roles`, event);
};
const subscribeToRoleEvents: SubscribeToEvent<{
  [workspaceID: string]: RoleEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:roles`, callback, {
    ...options,
    schema: roleEventType
  });
};

export { emitRoleEvent, subscribeToRoleEvents };
