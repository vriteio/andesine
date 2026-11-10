import { auth } from "#backend/lib/adapters/auth";
import { db } from "#backend/lib/adapters/postgres";
import { oauthClients } from "@andesine/server/database";
import { eq } from "drizzle-orm";
import { resolveUserAuthorization } from "#backend/lib/auth/user-authorization";
import { toUserID } from "@andesine/contracts/primitives";
import type { SessionData } from "#backend/lib/policy";
import { isAPIError } from "better-auth/api";
import { ORPCError } from "@orpc/server";

interface GetOAuthSessionDataInput {
  headers: Headers;
  token: string;
  requireWorkspace?: boolean;
}

const getSessionData = async (input: GetOAuthSessionDataInput): Promise<SessionData> => {
  let identity: Awaited<ReturnType<typeof auth.api.verifyAccessToken>>;

  try {
    identity = await auth.api.verifyAccessToken({ body: { token: input.token } });
  } catch (error) {
    if (!isAPIError(error) || error.statusCode >= 500) throw error;

    throw new ORPCError(error.statusCode === 403 ? "FORBIDDEN" : "UNAUTHORIZED", {
      message: "The OAuth access token is invalid, expired, or missing the required scope",
      data: {
        hints: ["Refresh your access token, or sign in again (andesine auth login for the CLI)."]
      }
    });
  }

  const [client] = await db
    .select({ name: oauthClients.name })
    .from(oauthClients)
    .where(eq(oauthClients.clientId, identity.clientID));

  return resolveUserAuthorization({
    headers: input.headers,
    requireWorkspace: input.requireWorkspace,
    userID: toUserID(identity.userID),
    type: "oauth",
    oauth: {
      clientID: identity.clientID,
      clientName: client?.name ?? undefined,
      scopes: identity.scopes,
      workspaceID: identity.workspaceID
    }
  });
};

export { getSessionData };
