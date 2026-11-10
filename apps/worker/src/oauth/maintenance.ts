import {
  CLI_CLIENT_ID,
  oauthAccessTokens,
  oauthClients,
  oauthConsents,
  oauthRefreshTokens
} from "@andesine/server/database";
import { and, eq, gt, inArray, isNull, lt, ne, notExists } from "drizzle-orm";
import { db } from "../database";

const UNUSED_CLIENT_AGE_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

/**
 * Removes OAuth clients that registered themselves (DCR creates one for each connection) and were
 * never approved or are no longer used: no consent and no valid token, a day after registration.
 */
const removeUnusedOAuthClients = async (): Promise<void> => {
  const now = new Date();
  const unused = and(
    ne(oauthClients.clientId, CLI_CLIENT_ID),
    isNull(oauthClients.userId),
    lt(oauthClients.createdAt, new Date(now.getTime() - UNUSED_CLIENT_AGE_MS)),
    notExists(
      db
        .select({ id: oauthConsents.id })
        .from(oauthConsents)
        .where(eq(oauthConsents.clientId, oauthClients.clientId))
    ),
    notExists(
      db
        .select({ id: oauthRefreshTokens.id })
        .from(oauthRefreshTokens)
        .where(
          and(
            eq(oauthRefreshTokens.clientId, oauthClients.clientId),
            isNull(oauthRefreshTokens.revoked),
            gt(oauthRefreshTokens.expiresAt, now)
          )
        )
    ),
    notExists(
      db
        .select({ id: oauthAccessTokens.id })
        .from(oauthAccessTokens)
        .where(
          and(
            eq(oauthAccessTokens.clientId, oauthClients.clientId),
            isNull(oauthAccessTokens.revoked),
            gt(oauthAccessTokens.expiresAt, now)
          )
        )
    )
  );

  let removed: number;

  do {
    const batch = db
      .select({ id: oauthClients.id })
      .from(oauthClients)
      .where(unused)
      .limit(BATCH_SIZE);
    const rows = await db.delete(oauthClients).where(inArray(oauthClients.id, batch)).returning({
      id: oauthClients.id
    });

    removed = rows.length;
  } while (removed === BATCH_SIZE);
};

export { removeUnusedOAuthClients };
