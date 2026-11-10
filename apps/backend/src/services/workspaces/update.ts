import { workspaces } from "@andesine/server/database";
import { toUUID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { withAuthorization } from "#backend/lib/policy";
import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

interface UpdateWorkspaceInput {
  name?: string;
}

const updateWorkspaceOperation = async (input: UpdateWorkspaceInput & { workspaceID: string }) => {
  if (input.name === undefined) return;

  const [updated] = await db
    .update(workspaces)
    .set({ name: input.name, updatedAt: new Date() })
    .where(eq(workspaces.id, toUUID(input.workspaceID)))
    .returning({ id: workspaces.id });

  if (!updated) throw new ORPCError("NOT_FOUND", { message: "Workspace not found" });
};
const updateWorkspace = withAuthorization<UpdateWorkspaceInput>(
  { permissions: { session: ["workspace"] } },
  async ({ input, workspaceID }) => updateWorkspaceOperation({ ...input, workspaceID })
);

export { updateWorkspace };
