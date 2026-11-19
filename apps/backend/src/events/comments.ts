import { type CommentThreadEvent } from "@andesine/contracts/events";
import { emitEvent, type EmitEvent } from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [commentThreadEvent: `${string}:comments`]: CommentThreadEvent;
  }
}

const emitCommentThreadEvent: EmitEvent<{
  [workspaceID: string]: CommentThreadEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:comments`, event);
};

export { emitCommentThreadEvent };
