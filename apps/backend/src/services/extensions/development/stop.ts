import { type ExtensionStateResult } from "@andesine/contracts/extensions";
import { transitionExtension } from "#backend/lib/extensions/lifecycle";
import { lockDevelopmentExtension, toExtensionStateResult } from "#backend/lib/extensions/state";
import { getUserAuthorization, withAuthorization } from "#backend/lib/policy";

interface StopInput {
  extensionID: string;
}

/** Disables the member's development extension; its configuration and storage stay. */
const stop = withAuthorization<StopInput, undefined, ExtensionStateResult>(
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
    const updated = await transitionExtension(database, extension, {
      event: "extension.disabled",
      set: { enabled: false }
    });

    return toExtensionStateResult(updated);
  }
);

export { stop };
