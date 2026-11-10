import { memberships, roles, workspaces } from "@andesine/server/database";
import { auth, db } from "#backend/lib/adapters";
import { toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, ne } from "drizzle-orm";

// Deletes the user with their sessions and accounts. Memberships go first, under the workspace
// locks that membership changes use, so a concurrent change can't remove a workspace's last admin.
const deleteUser = async (input: {
  userID: string;
  onMembershipsRemoved: () => void;
}): Promise<void> => {
  const userID = toUUID(input.userID);
  const { internalAdapter } = await auth.$context;

  await db.transaction(async (tx) => {
    const adminMemberships = await tx
      .select({ workspaceID: memberships.workspaceID })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleID))
      .where(and(eq(memberships.userID, userID), eq(roles.baseRole, "admin")));
    const workspaceIDs = adminMemberships.map(({ workspaceID }) => workspaceID);

    if (workspaceIDs.length) {
      await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(inArray(workspaces.id, workspaceIDs))
        .orderBy(workspaces.id)
        .for("update");

      const otherAdmins = await tx
        .select({ workspaceID: memberships.workspaceID })
        .from(memberships)
        .innerJoin(roles, eq(roles.id, memberships.roleID))
        .where(
          and(
            inArray(memberships.workspaceID, workspaceIDs),
            eq(roles.baseRole, "admin"),
            ne(memberships.userID, userID)
          )
        );
      const isLastAdmin = workspaceIDs.some((workspaceID) => {
        return !otherAdmins.some((admin) => admin.workspaceID === workspaceID);
      });

      if (isLastAdmin) {
        throw new ORPCError("CONFLICT", {
          message: "Another admin left a workspace at the same time. Try again."
        });
      }
    }

    await tx.delete(memberships).where(eq(memberships.userID, userID));
  });
  input.onMembershipsRemoved();
  await internalAdapter.deleteUser(userID);
};

export { deleteUser };
