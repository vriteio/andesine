import type { SessionData } from "#backend/lib/policy";
import {
  enqueueCurrentEntrySync,
  enqueueCurrentWorkspacePurge,
  enqueuePublishedWorkspacePurge
} from "#backend/lib/queue";
import { Auth } from "#backend/services/auth";
import { Billing } from "#backend/services/billing";
import { beginWorkspaceDeletion } from "./begin-deletion";
import { cancelWorkspaceDeletion } from "./cancel-deletion";
import { deleteWorkspace } from "./delete";

interface DestroyWorkspaceResult {
  entryIDs: string[];
  workspaceID: string | null;
}

// Settles billing before the data is deleted; the deletion is cancelled when that fails.
const destroyWorkspace = async (input: { auth: SessionData }): Promise<DestroyWorkspaceResult> => {
  const { workspaceID } = input.auth;
  const { deletingAt } = await beginWorkspaceDeletion({ auth: input.auth });

  try {
    await Auth.invalidateSessionData({ workspaceID });
    await Billing.settle({ workspaceID });
  } catch (error) {
    await cancelWorkspaceDeletion({ deletingAt, workspaceID });
    throw error;
  }

  const result = await deleteWorkspace({ auth: input.auth });

  await Promise.all([
    enqueueCurrentEntrySync({ workspaceID, entryIDs: result.entryIDs }),
    enqueueCurrentWorkspacePurge({ workspaceID }),
    enqueuePublishedWorkspacePurge({ workspaceID })
  ]);

  return result;
};

export { destroyWorkspace };
