import { auth } from "#backend/lib/adapters";
import { assertExpectedUser } from "#backend/lib/auth/expected-user";
import type { SessionData } from "#backend/lib/policy";
import { resolveUserAuthorization } from "#backend/lib/auth/user-authorization";
import { Memberships, type UserMembership } from "#backend/services/memberships";
import { toUserID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";

interface PrepareAccountDeletionInput {
  headers: Headers;
  userID: string;
}
interface AccountDeletion {
  workspaceSessions: SessionData[];
  remainingMemberships: UserMembership[];
}

const prepareAccountDeletion = async (
  input: PrepareAccountDeletionInput
): Promise<AccountDeletion> => {
  const [result, context] = await Promise.all([
    auth.api.getSession({ headers: input.headers }),
    auth.$context
  ]);

  if (!result) throw new ORPCError("UNAUTHORIZED");

  const userID = toUserID(result.session.userId);
  const { freshAge } = context.sessionConfig;
  const sessionAge = Date.now() - new Date(result.session.createdAt).getTime();
  const staleSession = freshAge !== 0 && sessionAge >= freshAge * 1000;

  assertExpectedUser(userID, input.userID);

  if (staleSession) {
    throw new ORPCError("SESSION_NOT_FRESH", {
      status: 403,
      message: "Verify your identity to continue"
    });
  }

  const userMemberships = await Memberships.listForUser({ userID });
  const workspaceSessions = await Promise.all(
    userMemberships
      .filter(({ soleAdmin }) => soleAdmin)
      .map(({ workspaceID }) => {
        const headers = new Headers(input.headers);

        headers.set("x-workspace-id", workspaceID);

        return resolveUserAuthorization({ userID, type: "session", headers });
      })
  );

  return {
    workspaceSessions,
    remainingMemberships: userMemberships.filter(({ soleAdmin }) => !soleAdmin)
  };
};

export { prepareAccountDeletion };
