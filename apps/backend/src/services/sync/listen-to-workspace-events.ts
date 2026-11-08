import { type WorkspaceEvent, workspaceEventType } from "@andesine/contracts/events";
import { subscribeToWorkspaceEvents } from "#backend/events";
import { viaIterator } from "#backend/lib/messaging";
import { SESSION_CHECK_INTERVAL } from "#backend/lib/auth/session-check";
import { Auth } from "#backend/services/auth";
import { ORPCError } from "@orpc/server";
import {
  type SessionData,
  filterRestrictedWorkspaceEvent,
  isSessionAuthorizationEvent,
  isRestrictedAuthorizationEvent,
  isWorkspaceEventVisible,
  withAuthorization
} from "#backend/lib/policy";

const createWorkspaceEventStream = async function* (input: {
  auth: SessionData;
  headers?: Headers;
  signal?: AbortSignal;
}) {
  const sessionEnded = new AbortController();
  const signal = input.signal
    ? AbortSignal.any([input.signal, sessionEnded.signal])
    : sessionEnded.signal;
  const events = viaIterator(subscribeToWorkspaceEvents, input.auth.workspaceID, { signal });
  const { headers } = input;
  // Credentials can be revoked or expire while the stream is open; a cookie check doesn't extend it.
  // Only an auth refusal ends the stream, so a database or Redis outage doesn't drop every client.
  const isAuthorized = async (headers: Headers): Promise<boolean> => {
    if (input.auth.type === "session") return Auth.isSessionActive({ headers });

    return Auth.getSessionData({ headers }).then(
      () => true,
      (error: unknown) => !(error instanceof ORPCError)
    );
  };
  const sessionCheck =
    headers &&
    setInterval(async () => {
      if (!(await isAuthorized(headers))) sessionEnded.abort();
    }, SESSION_CHECK_INTERVAL);

  try {
    for await (const event of events) {
      const parsedEvent = workspaceEventType.safeParse(event);

      if (!parsedEvent.success) {
        continue;
      }

      if (isSessionAuthorizationEvent(input.auth, parsedEvent.data)) {
        yield parsedEvent.data;
        return;
      }

      if (isRestrictedAuthorizationEvent(input.auth, parsedEvent.data)) return;

      if (!isWorkspaceEventVisible(input.auth, parsedEvent.data)) continue;

      const visibleEvent = await filterRestrictedWorkspaceEvent(input.auth, parsedEvent.data);

      if (visibleEvent) {
        yield visibleEvent;
      }
    }
  } finally {
    clearInterval(sessionCheck);
  }
};
const listenToWorkspaceEvents = withAuthorization<
  { headers?: Headers; signal?: AbortSignal },
  undefined,
  { events: AsyncGenerator<WorkspaceEvent, void, unknown> }
>({}, async ({ auth, input }) => ({
  events: createWorkspaceEventStream({ auth, headers: input.headers, signal: input.signal })
}));

export { listenToWorkspaceEvents };
