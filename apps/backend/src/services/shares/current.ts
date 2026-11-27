import {
  comments,
  commentThreads,
  entries,
  memberships,
  users,
  visitors,
  workspaces
} from "@andesine/server/database";
import { type ShareAccess } from "@andesine/contracts/entities";
import { toEntryID, toMembershipID, toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, lt } from "drizzle-orm";
import { getProfileImageURL } from "@andesine/server/assets";
import { config } from "#backend/lib/config";
import { withAuthorization } from "#backend/lib/policy";
import { DAY } from "#backend/lib/shares";

interface SharedEntry {
  share: { access: ShareAccess };
  entry: { id: string; name: string };
  workspace: { name: string; logo: string | null };
  visitor: { id: string; name: string | null };
  members: Array<{ id: string; name: string }>;
}
interface SharedEntryRow {
  entryID: string;
  entryName: string;
  collectionID: string | null;
  workspaceName: string;
  workspaceLogoID: string | null;
}

const getCurrentShare = withAuthorization<object, SharedEntryRow, SharedEntry>(
  {
    actions: ({ resolved }) => ({
      entries: [
        { action: "entry:read", collectionID: resolved.collectionID, entryID: resolved.entryID }
      ]
    }),
    resolve: async ({ auth, database }) => {
      if (!auth.visitor) throw new ORPCError("FORBIDDEN");

      const [row] = await database
        .select({
          entryID: entries.id,
          entryName: entries.name,
          collectionID: entries.collectionID,
          workspaceName: workspaces.name,
          workspaceLogoID: workspaces.logoAssetID
        })
        .from(entries)
        .innerJoin(workspaces, eq(workspaces.id, entries.workspaceID))
        .where(eq(entries.id, toUUID(auth.visitor.entryID)));

      if (!row) throw new ORPCError("NOT_FOUND");

      return row;
    }
  },
  async ({ auth, database, resolved }) => {
    const visitor = auth.visitor!;

    // The page loads this on each visit, so it marks the visitor as seen.
    await database
      .update(visitors)
      .set({ lastSeenAt: new Date() })
      .where(
        and(
          eq(visitors.id, toUUID(visitor.visitorID)),
          lt(visitors.lastSeenAt, new Date(Date.now() - DAY))
        )
      );
    const members = await database
      .selectDistinct({ id: memberships.id, name: users.name })
      .from(comments)
      .innerJoin(commentThreads, eq(commentThreads.id, comments.threadID))
      .innerJoin(memberships, eq(memberships.id, comments.authorID))
      .innerJoin(users, eq(users.id, memberships.userID))
      .where(eq(commentThreads.entryID, resolved.entryID));

    return {
      share: { access: visitor.access },
      entry: { id: toEntryID(resolved.entryID), name: resolved.entryName },
      workspace: {
        name: resolved.workspaceName,
        logo: resolved.workspaceLogoID
          ? getProfileImageURL(config.PUBLIC_API_URL, resolved.workspaceLogoID)
          : null
      },
      visitor: { id: visitor.visitorID, name: visitor.name },
      members: members.map(({ id, name }) => ({ id: toMembershipID(id), name }))
    };
  }
);

export { getCurrentShare };
