import { DEFAULT_PAGE_SIZE } from "#backend/lib/api/limits";
import { toPage, type Page, type PageInput } from "#backend/lib/api/pagination";
import { toMembershipID, toRoleID, toUUID, toUserID } from "#backend/lib/primitives";
import { db } from "#backend/lib/adapters";
import { type Membership, memberships, roles, type UserProfile, users } from "#backend/db";
import { withAuthorization } from "#backend/lib/policy";
import { and, asc, eq, gt } from "drizzle-orm";

interface MemberDetails extends Membership {
  roleName?: string;
  admin?: boolean;
  profile: UserProfile;
}

const listMembersOperation = async (
  input: PageInput & {
    workspaceID: string;
  }
): Promise<Page<MemberDetails>> => {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  const rows = await db
    .select({
      id: memberships.id,
      userID: memberships.userID,
      roleID: memberships.roleID,
      roleName: roles.name,
      baseRole: roles.baseRole,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userID))
    .innerJoin(roles, eq(roles.id, memberships.roleID))
    .where(
      and(
        eq(memberships.workspaceID, toUUID(input.workspaceID)),
        input.cursor ? gt(memberships.id, toUUID(input.cursor)) : undefined
      )
    )
    .orderBy(asc(memberships.id))
    .limit(limit + 1);

  return toPage(
    rows.map((row) => ({
      id: toMembershipID(row.id),
      userID: toUserID(row.userID),
      roleID: toRoleID(row.roleID),
      roleName: row.roleName,
      admin: row.baseRole === "admin",
      profile: {
        id: toUserID(row.userID),
        name: row.userName,
        email: row.userEmail,
        ...(row.userImage && { image: row.userImage })
      }
    })),
    limit
  );
};
const listMembers = withAuthorization<PageInput, undefined, Page<MemberDetails>>(
  { permissions: { session: true, key: ["read:memberships"] } },
  async ({ workspaceID, input }) => listMembersOperation({ workspaceID, ...input })
);

export { listMembers };
export type { MemberDetails };
