import { type ExtensionSessionToken } from "@andesine/contracts/extensions";
import { toUUID } from "@andesine/contracts/primitives";
import { extensions } from "@andesine/server/database";
import { db } from "#backend/lib/adapters";
import { isVisibleExtension } from "#backend/lib/extensions/installed";
import { issueSessionToken } from "#backend/lib/extensions/session-tokens";
import { withAuthorization } from "#backend/lib/policy";
import { consumeRateLimit } from "#backend/lib/security";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";

interface CreateSessionTokenInput {
  extensionID: string;
}

const SESSION_TOKEN_LIMIT = { max: 60, window: 60 };

/** The token is bound to the extension's version and generation. */
const createSessionToken = withAuthorization<
  CreateSessionTokenInput,
  undefined,
  ExtensionSessionToken
>({ permissions: { session: true } }, async ({ input, auth, workspaceID }) => {
  const member = auth.session!;
  const [extension] = await db
    .select()
    .from(extensions)
    .where(
      and(
        eq(extensions.id, toUUID(input.extensionID)),
        eq(extensions.workspaceID, workspaceID),
        isNull(extensions.uninstalledAt),
        isVisibleExtension(auth)
      )
    );
  const isActive = extension?.enabled && !extension.disabledReason;

  if (!isActive) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

  const limit = await consumeRateLimit({
    scope: "extension-session-token",
    key: `${input.extensionID}:${member.memberID}`,
    limit: SESSION_TOKEN_LIMIT
  });

  if (!limit.allowed) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "Too many extension session tokens. Try again later.",
      data: { limit: "rate", retryAfterSeconds: limit.retryAfter }
    });
  }

  return issueSessionToken({
    extensionID: input.extensionID,
    workspaceID: auth.workspaceID,
    membershipID: member.memberID,
    userID: member.userID,
    version: extension.version,
    generation: extension.generation
  });
});

export { createSessionToken };
