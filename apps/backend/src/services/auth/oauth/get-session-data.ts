import { auth } from "#backend/lib/adapters/auth";
import { resolveUserAuthorization } from "#backend/lib/auth/user-authorization";
import { toUserID } from "#backend/lib/primitives";
import type { SessionData } from "#backend/lib/policy";
import { APIError } from "better-auth/api";
import { ORPCError } from "@orpc/server";

interface GetOAuthSessionDataInput {
  headers: Headers;
  token: string;
  requireWorkspace?: boolean;
}

const getSessionData = async (input: GetOAuthSessionDataInput): Promise<SessionData> => {
  let identity: Awaited<ReturnType<typeof auth.api.verifyCLIAccessToken>>;

  try {
    identity = await auth.api.verifyCLIAccessToken({ body: { token: input.token } });
  } catch (error) {
    if (!(error instanceof APIError) || error.statusCode >= 500) throw error;

    throw new ORPCError(error.statusCode === 403 ? "FORBIDDEN" : "UNAUTHORIZED", {
      message: "The OAuth access token is invalid, expired, or missing the required scope",
      data: { hints: ["Refresh your access token or sign in again with andesine auth login."] }
    });
  }

  return resolveUserAuthorization({
    headers: input.headers,
    requireWorkspace: input.requireWorkspace,
    userID: toUserID(identity.userID),
    type: "oauth"
  });
};

export { getSessionData };
