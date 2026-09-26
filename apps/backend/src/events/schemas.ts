import { schemaEventType, type SchemaEvent } from "@andesine/contracts/events";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [schemaEvent: `${string}:schemas`]: SchemaEvent;
  }
}

const emitSchemaEvent: EmitEvent<{
  [workspaceID: string]: SchemaEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:schemas`, event);
};
const subscribeToSchemaEvents: SubscribeToEvent<{
  [workspaceID: string]: SchemaEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:schemas`, callback, {
    ...options,
    schema: schemaEventType
  });
};

export { emitSchemaEvent, subscribeToSchemaEvents };
