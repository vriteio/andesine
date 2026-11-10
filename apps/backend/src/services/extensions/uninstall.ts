import { type ExtensionStateResult } from "@andesine/contracts/extensions";
import { lockManagedExtension, toExtensionStateResult } from "#backend/lib/extensions/state";
import { uninstallExtension } from "#backend/lib/extensions/uninstall";
import { withAuthorization } from "#backend/lib/policy";

interface UninstallInput {
  extensionID: string;
  expectedRevision: number;
}

const uninstall = withAuthorization<UninstallInput, undefined, ExtensionStateResult>(
  { permissions: { session: ["extensions"] }, transaction: "locked-workspace" },
  async ({ auth, database, input, workspaceID }) => {
    const extension = await lockManagedExtension(
      database,
      auth,
      workspaceID,
      input.extensionID,
      input.expectedRevision
    );

    return toExtensionStateResult(await uninstallExtension(database, extension));
  }
);

export { uninstall };
