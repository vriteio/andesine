import { users } from "@andesine/server/database";
import { getProfileImageURL } from "@andesine/server/assets";
import { db } from "#backend/lib/adapters/postgres";
import { config } from "#backend/lib/config";
import { getUserAuthorization, type SessionData } from "#backend/lib/policy";
import { toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";

const getIdentity = async (input: { auth: SessionData }) => {
  const { auth } = input;
  const actor = getUserAuthorization(auth);

  if (auth.type === "key" && auth.key) {
    return { type: auth.type, keyID: auth.key.keyID, workspaceID: auth.workspaceID };
  }

  if (!actor || (auth.type !== "session" && auth.type !== "oauth")) {
    throw new ORPCError("UNAUTHORIZED");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, toUUID(actor.userID)), isNull(users.deletingAt)));

  if (!user) throw new ORPCError("UNAUTHORIZED");

  return {
    type: auth.type,
    user: {
      id: actor.userID,
      name: user.name,
      email: user.email,
      image: user.imageAssetID
        ? getProfileImageURL(config.PUBLIC_API_URL, user.imageAssetID)
        : user.image || undefined
    }
  };
};

export { getIdentity };
