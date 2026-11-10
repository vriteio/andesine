import { type ExtensionStateResult } from "@andesine/contracts/extensions";
import { lockManagedExtension, toExtensionStateResult } from "#backend/lib/extensions/state";
import { withAuthorization } from "#backend/lib/policy";
import { resolveDisabledReason } from "@andesine/server/extensions";
import { transitionExtension } from "#backend/lib/extensions/lifecycle";

interface SetEnabledInput {
  extensionID: string;
  enabled: boolean;
  expectedRevision: number;
}

/** A revoked version, pending approval, or missing configuration still blocks enabling. */
const setEnabled = withAuthorization<SetEnabledInput, undefined, ExtensionStateResult>(
  { permissions: { session: ["extensions"] }, transaction: "locked-workspace" },
  async ({ auth, database, input, workspaceID }) => {
    const extension = await lockManagedExtension(
      database,
      auth,
      workspaceID,
      input.extensionID,
      input.expectedRevision
    );
    const updated = input.enabled
      ? await transitionExtension(database, extension, {
          event: "extension.enabled",
          set: { enabled: true, disabledReason: await resolveDisabledReason(database, extension) }
        })
      : await transitionExtension(database, extension, {
          event: "extension.disabled",
          set: { enabled: false }
        });

    return toExtensionStateResult(updated);
  }
);

export { setEnabled };
