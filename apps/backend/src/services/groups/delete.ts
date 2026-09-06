import { assertGroupDelegation } from "#backend/lib/policy/delegation-collections";
import { groupMembers, groups, memberships } from "#backend/db";
import type { Database } from "#backend/lib/policy/service";
import { withAuthorization } from "#backend/lib/policy";
import { toUserID, toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

interface DeleteGroupInput {
  id: string;
}

const deleteGroupOperation = async (
  input: DeleteGroupInput & { workspaceID: string; database: Database }
): Promise<{ affectedUserIDs: string[] }> => {
  const groupID = toUUID(input.id);
  const workspaceID = toUUID(input.workspaceID);
  const [group] = await input.database
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupID), eq(groups.workspaceID, workspaceID)))
    .for("update");

  if (!group) throw new ORPCError("NOT_FOUND", { message: "Group not found" });

  const members = await input.database
    .select({ userID: memberships.userID })
    .from(groupMembers)
    .innerJoin(memberships, eq(memberships.id, groupMembers.membershipID))
    .where(and(eq(groupMembers.groupID, groupID), eq(groupMembers.workspaceID, workspaceID)));

  await input.database
    .delete(groups)
    .where(and(eq(groups.id, groupID), eq(groups.workspaceID, workspaceID)));

  return { affectedUserIDs: members.map(({ userID }) => toUserID(userID)) };
};
const deleteGroup = withAuthorization<DeleteGroupInput, undefined, { affectedUserIDs: string[] }>(
  {
    permissions: { session: ["memberships"] },
    plan: "pro",
    transaction: "locked-workspace"
  },
  async ({ auth, database, input, workspaceID }) => {
    await assertGroupDelegation(auth, input.id, database);
    return deleteGroupOperation({ ...input, database, workspaceID });
  }
);

export { deleteGroup };
