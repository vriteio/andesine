import { type ExtensionStateResult } from "@andesine/contracts/extensions";
import { lockDevelopmentExtension, toExtensionStateResult } from "#backend/lib/extensions/state";
import { uninstallExtension } from "#backend/lib/extensions/uninstall";
import { getUserAuthorization, withAuthorization } from "#backend/lib/policy";

interface RemoveInput {
  extensionID: string;
}

const remove = withAuthorization<RemoveInput, undefined, ExtensionStateResult>(
  {
    permissions: { session: ["extensions"], oauth: ["extensions"] },
    transaction: "locked-workspace"
  },
  async ({ auth, database, input, workspaceID }) => {
    const extension = await lockDevelopmentExtension(
      database,
      workspaceID,
      input.extensionID,
      getUserAuthorization(auth)!.memberID
    );

    return toExtensionStateResult(await uninstallExtension(database, extension));
  }
);

export { remove };
