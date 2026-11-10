import { oauthAccessTokens, oauthConsents, oauthRefreshTokens } from "@andesine/server/database";
import { db } from "#backend/lib/adapters/postgres";
import { toUUID } from "@andesine/contracts/primitives";
import { and, eq } from "drizzle-orm";

interface RevokeConnectedAppInput {
  userID: string;
  clientID: string;
}

const revokeConnectedApp = async (input: RevokeConnectedAppInput): Promise<void> => {
  const userID = toUUID(input.userID);

  await db.transaction(async (tx) => {
    await tx
      .delete(oauthAccessTokens)
      .where(
        and(eq(oauthAccessTokens.userId, userID), eq(oauthAccessTokens.clientId, input.clientID))
      );
    await tx
      .delete(oauthRefreshTokens)
      .where(
        and(eq(oauthRefreshTokens.userId, userID), eq(oauthRefreshTokens.clientId, input.clientID))
      );
    await tx
      .delete(oauthConsents)
      .where(and(eq(oauthConsents.userId, userID), eq(oauthConsents.clientId, input.clientID)));
  });
};

export { revokeConnectedApp };
