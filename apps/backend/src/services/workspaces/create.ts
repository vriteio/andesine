import { collections, memberships, roles, users, workspaces } from "@andesine/server/database";
import { type Permission } from "@andesine/contracts/entities";
import { rankBetweenNeighbors, toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { createInitialPublishingChannel } from "#backend/lib/publishing";
import { PUBLISHED_CHANNEL_CODE } from "@andesine/contracts/publishing";
import { ROOT_COLLECTION_NAME } from "@andesine/contracts/content";
import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { capture } from "#backend/lib/analytics";
import { seedExampleContent } from "./seed-example-content";

const DEFAULT_ROLES: Array<{
  name: string;
  permissions: Permission[];
  baseRole?: "admin" | "viewer";
}> = [
  { name: "Admin", permissions: [], baseRole: "admin" },
  { name: "Developer", permissions: ["content", "publishing", "api_keys"] },
  { name: "Editor", permissions: ["content", "publishing"] },
  { name: "Viewer", permissions: [], baseRole: "viewer" }
];

const createWorkspace = async (input: { name: string; userID: string }) => {
  const userID = toUUID(input.userID);

  const workspace = await db.transaction(async (tx) => {
    const [workspace] = await tx.insert(workspaces).values({ name: input.name }).returning();

    const createdRoles = await tx
      .insert(roles)
      .values(
        DEFAULT_ROLES.map((role) => ({
          workspaceID: workspace.id,
          name: role.name,
          permissions: role.permissions,
          baseRole: role.baseRole
        }))
      )
      .returning();
    const adminRole = createdRoles.find((role) => role.baseRole === "admin");

    if (!adminRole) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Admin role not found for workspace"
      });
    }

    await tx.insert(collections).values({
      workspaceID: workspace.id,
      parentID: null,
      name: ROOT_COLLECTION_NAME,
      rank: rankBetweenNeighbors()
    });
    await createInitialPublishingChannel(tx, {
      workspaceID: workspace.id,
      code: PUBLISHED_CHANNEL_CODE,
      name: "Published",
      builtIn: true,
      creatorID: userID
    });
    await tx.insert(memberships).values({
      userID,
      workspaceID: workspace.id,
      roleID: adminRole.id
    });
    await tx
      .update(users)
      .set({ currentWorkspaceID: workspace.id, updatedAt: new Date() })
      .where(eq(users.id, userID));

    return { id: toWorkspaceID(workspace.id), name: workspace.name };
  });

  let exampleContent = false;

  // The workspace is usable without the example content, so a failed seed is only logged.
  try {
    exampleContent = await seedExampleContent({ workspaceID: workspace.id, userID: input.userID });
  } catch (error) {
    console.error("Failed to add example content", { workspaceID: workspace.id, error });
  }

  capture("workspace_created", {
    userID: input.userID,
    workspaceID: workspace.id,
    properties: { example_content: exampleContent }
  });

  return workspace;
};

export { createWorkspace };
