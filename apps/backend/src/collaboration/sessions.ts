import type { Hocuspocus, WebSocketLike } from "@hocuspocus/server";
import { SESSION_CHECK_INTERVAL } from "#backend/lib/auth/session-check";
import { Auth } from "#backend/services/auth";
import type { CollaborationContext } from "./types";

/** Closes connections whose cookie session was revoked or expired; each cookie is checked once. */
const closeEndedSessions = async (collab: Hocuspocus<CollaborationContext>): Promise<void> => {
  const cookies = new Map<string, Set<WebSocketLike>>();

  for (const document of collab.documents.values()) {
    for (const connection of document.getConnections()) {
      const cookie = connection.context.sessionCookie;

      if (!cookie) continue;

      cookies.set(cookie, (cookies.get(cookie) ?? new Set()).add(connection.webSocket));
    }
  }

  for (const [cookie, sockets] of cookies) {
    if (await Auth.isSessionActive({ headers: new Headers({ cookie }) })) continue;

    for (const socket of sockets) socket.close(4401, "Unauthorized");
  }
};
// shortcut: one loop per process checks every connection in turn; fine for thousands of open
// documents, split the checks across intervals if a process holds far more.
const watchCollaborationSessions = (collab: Hocuspocus<CollaborationContext>): void => {
  // The next check waits for this one, so slow checks don't pile up.
  const checkSessions = () => {
    closeEndedSessions(collab)
      .catch((error: unknown) => {
        console.error("Failed to check collaboration sessions", { error });
      })
      .finally(() => setTimeout(checkSessions, SESSION_CHECK_INTERVAL).unref());
  };

  setTimeout(checkSessions, SESSION_CHECK_INTERVAL).unref();
};

export { watchCollaborationSessions };
