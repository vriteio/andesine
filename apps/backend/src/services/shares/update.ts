import { entryShares } from "@andesine/server/database";
import { type Share, type ShareAccess } from "@andesine/contracts/entities";
import { toEntryID } from "@andesine/contracts/primitives";
import { eq } from "drizzle-orm";
import { withAuthorization } from "#backend/lib/policy";
import {
  getShareActions,
  limitExpiry,
  loadSharingPolicy,
  mapShare,
  resolveShare,
  toExpiresAt,
  type ShareTarget
} from "#backend/lib/shares";

interface UpdateShareInput {
  id: string;
  access?: ShareAccess;
  expiresAt?: string | null;
}

const updateShare = withAuthorization<UpdateShareInput, ShareTarget, Share>(
  {
    actions: ({ input, resolved }) => {
      const { access, entryID } = resolved.share;

      return {
        entries: getShareActions(input.access ?? access, resolved.collectionID, toEntryID(entryID))
      };
    },
    resolve: ({ database, input, workspaceID }) => {
      return resolveShare(database, workspaceID, input.id);
    }
  },
  async ({ database, input, resolved, workspaceID }) => {
    const expiresAt = toExpiresAt(input.expiresAt);
    const policy = await loadSharingPolicy(database, workspaceID);
    const [row] = await database
      .update(entryShares)
      .set({
        access: input.access,
        expiresAt: expiresAt === undefined ? undefined : limitExpiry(policy, expiresAt),
        updatedAt: new Date()
      })
      .where(eq(entryShares.id, resolved.share.id))
      .returning();

    return mapShare(row);
  }
);

export { updateShare };
