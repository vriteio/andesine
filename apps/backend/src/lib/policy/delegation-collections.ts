import {
  collectionGroupRoles,
  collectionMemberRoles,
  collections,
  roles,
  type Permission
} from "#backend/db";
import { and, eq, isNull } from "drizzle-orm";
import { loadAuthorizedCollectionTree } from "./authorized-collection-tree";
import type { DatabaseClient } from "./service";
import type { SessionData } from "./session";
import { isAdminAuthorization } from "./permissions";
import { toUUID } from "#backend/lib/primitives";

const assertCollectionRoleDelegation = async (
  auth: SessionData,
  permissions: Permission[],
  collectionID: string,
  database: DatabaseClient
): Promise<void> => {
  if (isAdminAuthorization(auth)) return;

  const authorization = await loadAuthorizedCollectionTree({ auth, database });

  authorization.assertCollectionAction(collectionID, "collection:manage-restricted-access");
  if (permissions.includes("content")) {
    authorization.assertEntryAction(collectionID, "entry:update");
  }
  if (permissions.includes("publishing")) {
    authorization.assertCollectionAction(collectionID, "collection:set-publishing");
  }
};
const assertRoleAssignmentsDelegation = async (
  auth: SessionData,
  roleID: string,
  permissions: Permission[],
  database: DatabaseClient
): Promise<void> => {
  if (isAdminAuthorization(auth)) return;

  const workspaceID = toUUID(auth.workspaceID);
  const [direct, groups] = await Promise.all([
    database
      .select({ collectionID: collectionMemberRoles.collectionID })
      .from(collectionMemberRoles)
      .innerJoin(collections, eq(collections.id, collectionMemberRoles.collectionID))
      .where(
        and(
          eq(collectionMemberRoles.workspaceID, workspaceID),
          eq(collectionMemberRoles.roleID, toUUID(roleID)),
          eq(collections.restricted, true),
          isNull(collections.deletedAt)
        )
      ),
    database
      .select({ collectionID: collectionGroupRoles.collectionID })
      .from(collectionGroupRoles)
      .innerJoin(collections, eq(collections.id, collectionGroupRoles.collectionID))
      .where(
        and(
          eq(collectionGroupRoles.workspaceID, workspaceID),
          eq(collectionGroupRoles.roleID, toUUID(roleID)),
          eq(collections.restricted, true),
          isNull(collections.deletedAt)
        )
      )
  ]);

  for (const collectionID of new Set([...direct, ...groups].map((row) => row.collectionID))) {
    await assertCollectionRoleDelegation(auth, permissions, collectionID, database);
  }
};
const assertGroupDelegation = async (
  auth: SessionData,
  groupID: string,
  database: DatabaseClient
): Promise<void> => {
  if (isAdminAuthorization(auth)) return;

  const assignments = await database
    .select({ collectionID: collectionGroupRoles.collectionID, permissions: roles.permissions })
    .from(collectionGroupRoles)
    .innerJoin(roles, eq(roles.id, collectionGroupRoles.roleID))
    .innerJoin(collections, eq(collections.id, collectionGroupRoles.collectionID))
    .where(
      and(
        eq(collectionGroupRoles.workspaceID, toUUID(auth.workspaceID)),
        eq(collectionGroupRoles.groupID, toUUID(groupID)),
        eq(collections.restricted, true),
        isNull(collections.deletedAt)
      )
    );

  for (const assignment of assignments) {
    await assertCollectionRoleDelegation(
      auth,
      assignment.permissions,
      assignment.collectionID,
      database
    );
  }
};

export { assertCollectionRoleDelegation, assertRoleAssignmentsDelegation, assertGroupDelegation };
