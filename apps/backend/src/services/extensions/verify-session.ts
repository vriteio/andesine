import { type ExtensionSession } from "@andesine/contracts/extensions";
import { hasPermission } from "@andesine/contracts/permissions";
import { toUUID } from "@andesine/contracts/primitives";
import { getProfileImageURL } from "@andesine/server/assets";
import { memberships, users } from "@andesine/server/database";
import { db, redis } from "#backend/lib/adapters";
import { config } from "#backend/lib/config";
import {
  getSessionTokenKey,
  type StoredExtensionSession
} from "#backend/lib/extensions/session-tokens";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";

interface VerifySessionInput {
  token: string;
}

const invalid = (): ORPCError<"NOT_FOUND", unknown> => {
  return new ORPCError("NOT_FOUND", { message: "The session token is not valid" });
};
/** The token must match this extension's current generation; email needs `read:memberships`. */
const verifySession = withAuthorization<VerifySessionInput, undefined, ExtensionSession>(
  { permissions: { extension: true } },
  async ({ input, auth }) => {
    const extension = auth.extension!;
    const stored = await redis.get(getSessionTokenKey(input.token));
    const session = stored ? (JSON.parse(stored) as StoredExtensionSession) : null;
    const isOwn =
      session?.extensionID === extension.extensionID &&
      session.generation === extension.generation &&
      session.workspaceID === auth.workspaceID;

    if (!session || !isOwn) throw invalid();

    const [member] = await db
      .select({
        name: users.name,
        email: users.email,
        image: users.image,
        imageAssetID: users.imageAssetID
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userID))
      .where(
        and(
          eq(memberships.id, toUUID(session.membershipID)),
          eq(memberships.workspaceID, toUUID(session.workspaceID)),
          isNull(users.deletingAt)
        )
      );

    if (!member) throw invalid();

    const image = member.imageAssetID
      ? getProfileImageURL(config.PUBLIC_API_URL, member.imageAssetID)
      : member.image;
    const canReadEmail = extension.permissions.some((permission) => {
      return hasPermission(permission, "read:memberships");
    });

    return {
      workspaceID: session.workspaceID,
      version: session.version,
      member: {
        id: session.membershipID,
        userID: session.userID,
        profile: {
          id: session.userID,
          ...(member.name && { name: member.name }),
          ...(image && { image }),
          ...(canReadEmail && { email: member.email })
        }
      }
    };
  }
);

export { verifySession };
