import { workspaceEventType, type WorkspaceEvent } from "@andesine/contracts/events";
import { type SubscribeToEvent, subscribeToEvent } from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [workspaceEvent: string]: WorkspaceEvent;
  }
}

const subscribeToWorkspaceEvents: SubscribeToEvent<{
  [workspaceID: string]: WorkspaceEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:*`, callback, {
    ...options,
    schema: workspaceEventType
  });
};

export { subscribeToWorkspaceEvents };

export * from "./entries";
export * from "./groups";
export * from "./collections";
export * from "./memberships";
export * from "./roles";
export * from "./keys";
export * from "./workspaces";
export * from "./publishing";
export * from "./versions";
export * from "./webhooks";
export * from "./schema-versions";
export * from "./schema-migrations";
export * from "./schemas";
