import { type ExtensionStateResult } from "@andesine/contracts/extensions";
import { lockManagedExtension, toExtensionStateResult } from "#backend/lib/extensions/state";
import { withAuthorization } from "#backend/lib/policy";
import { canGrantExtensionPermission } from "#backend/lib/policy/delegation-permissions";
import { ORPCError } from "@orpc/server";
import {
  getManifestGrant,
  resolveDisabledReason,
  getExtensionManifest
} from "@andesine/server/extensions";
import { transitionExtension } from "#backend/lib/extensions/lifecycle";

interface ApproveInput {
  extensionID: string;
  expectedRevision: number;
}

/** Approves a grant that an update expanded; the manager must be able to grant all of it. */
const approve = withAuthorization<ApproveInput, undefined, ExtensionStateResult>(
  { permissions: { session: ["extensions"] }, transaction: "locked-workspace" },
  async ({ auth, database, input, workspaceID }) => {
    const extension = await lockManagedExtension(
      database,
      auth,
      workspaceID,
      input.extensionID,
      input.expectedRevision
    );
    const manifest = await getExtensionManifest(database, extension);

    if (extension.disabledReason !== "approval_required" || !manifest) {
      throw new ORPCError("CONFLICT", { message: "The extension has nothing to approve" });
    }

    const grant = getManifestGrant(manifest);
    const missingPermissions = grant.permissions.filter((permission) => {
      return !canGrantExtensionPermission(auth, permission);
    });

    if (missingPermissions.length) {
      throw new ORPCError("FORBIDDEN", {
        message: `You cannot grant these permissions: ${missingPermissions.join(", ")}`
      });
    }

    const updated = await transitionExtension(database, extension, {
      event: "extension.enabled",
      set: {
        ...grant,
        disabledReason: await resolveDisabledReason(database, { ...extension, ...grant })
      }
    });

    return toExtensionStateResult(updated);
  }
);

export { approve };
