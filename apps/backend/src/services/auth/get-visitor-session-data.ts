import {
  entries,
  entryShares,
  visitors,
  visitorTokens,
  workspaces
} from "@andesine/server/database";
import {
  toCollectionID,
  toEntryID,
  toVisitorID,
  toShareID,
  toWorkspaceID
} from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { type SessionData } from "#backend/lib/policy";
import { hashKey } from "#backend/lib/security";
import { ACCOUNT_TOKEN_LIFETIME, isShareKindEnabled } from "#backend/lib/shares";
import { ORPCError } from "@orpc/server";
import { and, eq, gt, isNull, or } from "drizzle-orm";

/** Not cached, so removed and expired shares stop at once. */
const getVisitorSessionData = async (token: string): Promise<SessionData> => {
  const [row] = await db
    .select({
      visitorID: visitors.id,
      name: visitors.name,
      shareID: entryShares.id,
      access: entryShares.access,
      entryID: entries.id,
      collectionID: entries.collectionID,
      workspaceID: workspaces.id,
      subscriptionPlan: workspaces.subscriptionPlan
    })
    .from(visitorTokens)
    .innerJoin(visitors, eq(visitors.id, visitorTokens.visitorID))
    .innerJoin(entryShares, eq(entryShares.id, visitors.shareID))
    .innerJoin(entries, eq(entries.id, entryShares.entryID))
    .innerJoin(workspaces, eq(workspaces.id, entries.workspaceID))
    .where(
      and(
        eq(visitorTokens.tokenHash, hashKey(token)),
        or(
          isNull(visitors.userID),
          gt(visitorTokens.createdAt, new Date(Date.now() - ACCOUNT_TOKEN_LIFETIME))
        ),
        or(isNull(entryShares.expiresAt), gt(entryShares.expiresAt, new Date())),
        isNull(entries.deletedAt),
        isNull(workspaces.deletingAt),
        isShareKindEnabled
      )
    );

  if (!row) throw new ORPCError("UNAUTHORIZED");

  return {
    id: `visitor:${row.visitorID}`,
    type: "visitor",
    subscriptionPlan: row.subscriptionPlan,
    workspaceID: toWorkspaceID(row.workspaceID),
    visitor: {
      visitorID: toVisitorID(row.visitorID),
      shareID: toShareID(row.shareID),
      entryID: toEntryID(row.entryID),
      collectionID: row.collectionID ? toCollectionID(row.collectionID) : null,
      access: row.access,
      name: row.name
    }
  };
};

export { getVisitorSessionData };
