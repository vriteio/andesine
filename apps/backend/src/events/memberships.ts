import { membershipEventType, type MembershipEvent } from "@andesine/contracts/events";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [membershipEvent: `${string}:memberships`]: MembershipEvent;
  }
}

const emitMembershipEvent: EmitEvent<{
  [workspaceID: string]: MembershipEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:memberships`, event);
};
const subscribeToMembershipEvents: SubscribeToEvent<{
  [workspaceID: string]: MembershipEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:memberships`, callback, {
    ...options,
    schema: membershipEventType
  });
};

export { emitMembershipEvent, subscribeToMembershipEvents };
