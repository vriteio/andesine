import { schemaVersionEventType, type SchemaVersionEvent } from "@andesine/contracts/events";
import { type SchemaVersionSummary } from "@andesine/contracts/schema";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [schemaVersionEvent: `${string}:schema-versions`]: SchemaVersionEvent;
  }
}

const emitSchemaVersionEvent: EmitEvent<{
  [workspaceID: string]: SchemaVersionEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:schema-versions`, event);
};
const emitSchemaVersionCreationEvents = (
  workspaceID: string,
  versions: SchemaVersionSummary[],
  memberID?: string
): void => {
  for (const version of versions) {
    emitSchemaVersionEvent(workspaceID, {
      action: "schema-version:create",
      data: version,
      memberID
    });
  }
};
const subscribeToSchemaVersionEvents: SubscribeToEvent<{
  [workspaceID: string]: SchemaVersionEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:schema-versions`, callback, {
    ...options,
    schema: schemaVersionEventType
  });
};

export { emitSchemaVersionCreationEvents, emitSchemaVersionEvent, subscribeToSchemaVersionEvents };
