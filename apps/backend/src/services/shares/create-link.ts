import { entryShares } from "@andesine/server/database";
import { type Share, type ShareAccess } from "@andesine/contracts/entities";
import { and, eq, sql } from "drizzle-orm";
import { withAuthorization } from "#backend/lib/policy";
import {
  createLinkToken,
  getCreatorID,
  getShareActions,
  mapShare,
  removeUnusedVisitors,
  resolveShareEntry,
  toExpiresAt,
  assertShareKindEnabled,
  limitExpiry,
  loadSharingPolicy,
  type ShareEntry
} from "#backend/lib/shares";

interface CreateShareLinkInput {
  entryID: string;
  access: ShareAccess;
  expiresAt: string | null;
}

/** A new token replaces the link's old one, and its visitors lose access. */
const createShareLink = withAuthorization<CreateShareLinkInput, ShareEntry, Share>(
  {
    actions: ({ input, resolved }) => ({
      entries: getShareActions(input.access, resolved.collectionID, input.entryID)
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveShareEntry(database, workspaceID, input.entryID);
    },
    transaction: "atomic"
  },
  async ({ auth, database, input, resolved, workspaceID }) => {
    const policy = await loadSharingPolicy(database, workspaceID);

    assertShareKindEnabled(policy, "link");

    const values = {
      token: createLinkToken(),
      access: input.access,
      expiresAt: limitExpiry(policy, toExpiresAt(input.expiresAt) ?? null),
      updatedAt: new Date()
    };
    const [existing] = await database
      .select({ id: entryShares.id })
      .from(entryShares)
      .where(and(eq(entryShares.entryID, resolved.id), eq(entryShares.kind, "link")))
      .for("update");

    // A new row, so joins that read the old token can't add visitors to it; old visitors lose it.
    if (existing) {
      await database.delete(entryShares).where(eq(entryShares.id, existing.id));
      await removeUnusedVisitors(database, workspaceID);
    }

    const [row] = await database
      .insert(entryShares)
      .values({
        ...values,
        workspaceID,
        entryID: resolved.id,
        kind: "link",
        createdByID: getCreatorID(auth)
      })
      // A concurrent request created the link first; the latest settings win.
      .onConflictDoUpdate({
        target: entryShares.entryID,
        targetWhere: sql`${entryShares.kind} = 'link'`,
        set: values
      })
      .returning();

    return mapShare(row);
  }
);

export { createShareLink };
