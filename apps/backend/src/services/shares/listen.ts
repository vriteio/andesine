import { type WorkspaceEvent, workspaceEventType } from "@andesine/contracts/events";
import { toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { subscribeToWorkspaceEvents } from "#backend/events";
import { SESSION_CHECK_INTERVAL } from "#backend/lib/auth/session-check";
import { viaIterator } from "#backend/lib/messaging";
import { type VisitorAuthorization, withAuthorization } from "#backend/lib/policy";
import { resolveVisitorEntry, type VisitorEntry } from "#backend/lib/shares";
import { Auth } from "#backend/services/auth";

interface ListenToShareEventsInput {
  headers: Headers;
  signal?: AbortSignal;
}

const isSharedEntryEvent = (visitor: VisitorAuthorization, event: WorkspaceEvent): boolean => {
  const isCommentEvent =
    event.action === "comment-thread:update" || event.action === "comment-thread:delete";

  return isCommentEvent && toUUID(event.data.entryID) === toUUID(visitor.entryID);
};
/** Ends once the share is removed or expires, at the next check. */
const streamShareEvents = async function* (
  visitor: VisitorAuthorization,
  workspaceID: string,
  input: ListenToShareEventsInput
) {
  const shareEnded = new AbortController();
  const signal = input.signal
    ? AbortSignal.any([input.signal, shareEnded.signal])
    : shareEnded.signal;
  const events = viaIterator(subscribeToWorkspaceEvents, workspaceID, { signal });
  // Only a refusal ends it, so an outage doesn't drop every visitor.
  const shareCheck = setInterval(() => {
    Auth.getSessionData({ headers: input.headers }).catch((error: unknown) => {
      if (error instanceof ORPCError) shareEnded.abort();
    });
  }, SESSION_CHECK_INTERVAL);

  try {
    for await (const event of events) {
      const parsed = workspaceEventType.safeParse(event);

      if (parsed.success && isSharedEntryEvent(visitor, parsed.data)) yield parsed.data;
    }
  } finally {
    clearInterval(shareCheck);
  }
};
const listenToShareEvents = withAuthorization<
  ListenToShareEventsInput,
  VisitorEntry,
  { events: AsyncGenerator<WorkspaceEvent, void, unknown> }
>(
  {
    actions: ({ resolved }) => ({ entries: [{ action: "entry:read", ...resolved }] }),
    resolve: async ({ auth }) => resolveVisitorEntry(auth)
  },
  async ({ auth, input }) => ({
    events: streamShareEvents(auth.visitor!, auth.workspaceID, input)
  })
);

export { listenToShareEvents };
