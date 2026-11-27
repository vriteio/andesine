import { entryShares } from "@andesine/server/database";
import { type Share, type ShareAccess } from "@andesine/contracts/entities";
import { sql } from "drizzle-orm";
import { withAuthorization } from "#backend/lib/policy";
import {
  deliverShare,
  getCreatorID,
  getShareActions,
  mapShare,
  resolveShareEntry,
  toExpiresAt,
  assertShareKindEnabled,
  limitExpiry,
  loadSharingPolicy,
  type ShareEntry
} from "#backend/lib/shares";

interface InviteToEntryInput {
  entryID: string;
  email: string;
  access: ShareAccess;
  expiresAt: string | null;
}

/** Sharing with the same email again updates the share and sends the email again. */
const inviteToEntry = withAuthorization<InviteToEntryInput, ShareEntry, Share>(
  {
    actions: ({ input, resolved }) => ({
      entries: getShareActions(input.access, resolved.collectionID, input.entryID)
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveShareEntry(database, workspaceID, input.entryID);
    }
  },
  async ({ auth, database, input, resolved, workspaceID }) => {
    const policy = await loadSharingPolicy(database, workspaceID);

    assertShareKindEnabled(policy, "email");

    const changes = {
      access: input.access,
      expiresAt: limitExpiry(policy, toExpiresAt(input.expiresAt) ?? null),
      updatedAt: new Date()
    };
    const [row] = await database
      .insert(entryShares)
      .values({
        ...changes,
        workspaceID,
        entryID: resolved.id,
        kind: "email",
        email: input.email.toLowerCase(),
        createdByID: getCreatorID(auth)
      })
      .onConflictDoUpdate({
        target: [entryShares.entryID, entryShares.email],
        targetWhere: sql`${entryShares.kind} = 'email'`,
        set: changes
      })
      .returning();

    await deliverShare(auth, row, resolved.name);

    return mapShare(row);
  }
);

export { inviteToEntry };
