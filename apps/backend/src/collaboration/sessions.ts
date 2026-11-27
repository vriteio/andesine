import type { Hocuspocus, WebSocketLike } from "@hocuspocus/server";
import { ORPCError } from "@orpc/server";
import { SESSION_CHECK_INTERVAL } from "#backend/lib/auth/session-check";
import { Auth } from "#backend/services/auth";
import type { CollaborationContext } from "./types";

/** An error other than a refusal counts as active, so an outage keeps connections open. */
const isVisitorActive = (token: string): Promise<boolean> => {
  return Auth.getSessionData({ headers: new Headers({ authorization: `Bearer ${token}` }) }).then(
    () => true,
    (error: unknown) => !(error instanceof ORPCError)
  );
};
/**
 * Closes connections whose cookie session was revoked or expired, or whose share was removed or
 * expired; each credential is checked once.
 */
const closeEndedSessions = async (collab: Hocuspocus<CollaborationContext>): Promise<void> => {
  const credentials = new Map<string, Set<WebSocketLike>>();

  for (const document of collab.documents.values()) {
    for (const connection of document.getConnections()) {
      const { visitorToken, sessionCookie } = connection.context;
      const credential = visitorToken ?? (sessionCookie && `cookie:${sessionCookie}`);

      if (!credential) continue;

      credentials.set(
        credential,
        (credentials.get(credential) ?? new Set()).add(connection.webSocket)
      );
    }
  }

  for (const [credential, sockets] of credentials) {
    const isActive = credential.startsWith("cookie:")
      ? await Auth.isSessionActive({ headers: new Headers({ cookie: credential.slice(7) }) })
      : await isVisitorActive(credential);

    if (isActive) continue;

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
