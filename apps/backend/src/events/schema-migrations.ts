import { schemaMigrationEventType, type SchemaMigrationEvent } from "@andesine/contracts/events";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [schemaMigrationEvent: `${string}:schema-migrations`]: SchemaMigrationEvent;
  }
}

const emitSchemaMigrationEvent: EmitEvent<{
  [workspaceID: string]: SchemaMigrationEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:schema-migrations`, event);
};
const subscribeToSchemaMigrationEvents: SubscribeToEvent<{
  [workspaceID: string]: SchemaMigrationEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:schema-migrations`, callback, {
    ...options,
    schema: schemaMigrationEventType
  });
};

export { emitSchemaMigrationEvent, subscribeToSchemaMigrationEvents };
