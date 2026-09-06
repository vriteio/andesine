import { withAuthorization } from "#backend/lib/policy";
import { toWorkspaceID } from "#backend/lib/primitives";
import { saveGroup, type SaveGroupInput, type SaveGroupResult } from "./update";

type CreateGroupInput = Omit<SaveGroupInput, "workspaceID">;

const createGroup = withAuthorization<CreateGroupInput, undefined, SaveGroupResult>(
  { permissions: { session: ["memberships"] }, plan: "pro" },
  async ({ auth, input, workspaceID }) => {
    return saveGroup({ ...input, auth, workspaceID: toWorkspaceID(workspaceID) });
  }
);

export { createGroup };
