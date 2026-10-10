import { extensionEventType, type ExtensionEvent } from "@andesine/contracts/events";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [extensionEvent: `${string}:extensions`]: ExtensionEvent;
  }
}

// UI refresh signals only. Payloads carry the extension ID.

const emitExtensionEvent: EmitEvent<{
  [workspaceID: string]: ExtensionEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:extensions`, event);
};
const subscribeToExtensionEvents: SubscribeToEvent<{
  [workspaceID: string]: ExtensionEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:extensions`, callback, {
    ...options,
    schema: extensionEventType
  });
};

export { emitExtensionEvent, subscribeToExtensionEvents };
