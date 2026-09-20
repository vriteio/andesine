import { DEFAULT_PAGE_SIZE } from "#backend/lib/api/limits";
import { toPage, type Page, type PageInput } from "#backend/lib/api/pagination";
import {
  toInviteID,
  toMembershipID,
  toRoleID,
  toUUID,
  toWorkspaceID
} from "#backend/lib/primitives";
import { db } from "#backend/lib/adapters";
import { type Invite, invitations } from "#backend/db";
import { createInviteLink } from "#backend/lib/messaging";
import { withAuthorization } from "#backend/lib/policy";
import { and, asc, eq, gt, lt } from "drizzle-orm";

interface InviteDetails extends Invite {
  inviteLink: string;
  workspaceID: string;
  invitedBy?: string;
}

const listInvitesOperation = async (
  input: PageInput & {
    workspaceID: string;
  }
): Promise<Page<InviteDetails>> => {
  const workspaceID = toUUID(input.workspaceID);
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  await db
    .update(invitations)
    .set({ status: "expired" })
    .where(
      and(
        eq(invitations.workspaceID, workspaceID),
        eq(invitations.status, "pending"),
        lt(invitations.expiresAt, new Date())
      )
    );
  const rows = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.workspaceID, workspaceID),
        eq(invitations.status, "pending"),
        gt(invitations.expiresAt, new Date()),
        input.cursor ? gt(invitations.id, toUUID(input.cursor)) : undefined
      )
    )
    .orderBy(asc(invitations.id))
    .limit(limit + 1);

  return toPage(
    rows.map((invite) => {
      const id = toInviteID(invite.id);

      return {
        id,
        email: invite.email,
        inviteLink: createInviteLink({ id, expiresAt: invite.expiresAt }),
        workspaceID: toWorkspaceID(workspaceID),
        roleID: toRoleID(invite.roleID),
        invitedBy: invite.invitedBy ? toMembershipID(invite.invitedBy) : undefined,
        status: invite.status,
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString()
      };
    }),
    limit
  );
};
const listInvites = withAuthorization<PageInput, undefined, Page<InviteDetails>>(
  { permissions: { session: ["memberships"], key: ["memberships"] }, plan: "pro" },
  async ({ workspaceID, input }) => listInvitesOperation({ workspaceID, ...input })
);

export { listInvites };
export type { InviteDetails };
