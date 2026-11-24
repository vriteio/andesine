import {
  collectionGroupRoles,
  collectionMemberRoles,
  collections,
  roles,
  type DatabaseClient
} from "@andesine/server/database";
import { type KeyPermission, type Permission } from "@andesine/contracts/entities";
import { keyPermissionRequirements } from "@andesine/contracts/permissions";
import { and, eq, isNull } from "drizzle-orm";
import { loadAuthorizedCollectionTree } from "./authorized-collection-tree";
import type { SessionData } from "./session";
import { hasAuthPermission, isAdminAuthorization } from "./permissions";
import { toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";

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
// Without workspace-wide access, only accessible collections can be delegated, within the
// manager's role there. A selection never reaches nested boundaries, which need their own.
const assertRestrictedScopeDelegation = async (
  auth: SessionData,
  collectionIDs: string[],
  permissions: Permission[],
  database: DatabaseClient
): Promise<void> => {
  if (!collectionIDs.length || hasAuthPermission(auth, "read:restricted_collections")) return;

  // Stored selections may be in the trash; added ones are checked for existence separately.
  const authorization = await loadAuthorizedCollectionTree({
    auth,
    database,
    includeDeleted: true
  });

  for (const collectionID of collectionIDs) {
    if (!authorization.canAccessCollection(collectionID)) throw new ORPCError("NOT_FOUND");

    if (permissions.includes("content")) {
      authorization.assertEntryAction(collectionID, "entry:update");
    }

    if (permissions.includes("publishing")) {
      authorization.assertCollectionAction(collectionID, "collection:set-publishing");
    }
  }
};
const assertRestrictedKeyDelegation = (
  auth: SessionData,
  collectionIDs: string[],
  keyPermissions: KeyPermission[],
  database: DatabaseClient
): Promise<void> => {
  const permissions = keyPermissions.flatMap((permission) => {
    return keyPermissionRequirements[permission];
  });

  return assertRestrictedScopeDelegation(auth, collectionIDs, permissions, database);
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

export {
  assertCollectionRoleDelegation,
  assertRestrictedKeyDelegation,
  assertRestrictedScopeDelegation,
  assertRoleAssignmentsDelegation,
  assertGroupDelegation
};
