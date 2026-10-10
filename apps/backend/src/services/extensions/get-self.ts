import { type ExtensionSelf } from "@andesine/contracts/extensions";
import { toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import { extensions } from "@andesine/server/database";
import { db } from "#backend/lib/adapters";
import { getExtensionState } from "#backend/lib/extensions/state";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";

/** The extension that the JWT's subject names, also when it is disabled or uninstalled. */
const getSelf = withAuthorization<Record<never, never>, undefined, ExtensionSelf>(
  { permissions: { extension: true } },
  async ({ auth }) => {
    const extensionID = auth.extension!.extensionID;
    const [row] = await db
      .select()
      .from(extensions)
      .where(eq(extensions.id, toUUID(extensionID)));

    if (!row) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

    const state = getExtensionState(row);

    return {
      id: extensionID,
      name: row.name,
      version: row.version,
      workspaceID: toWorkspaceID(row.workspaceID),
      state,
      disabledReason: state === "disabled" ? (row.disabledReason ?? "manual") : null
    };
  }
);

export { getSelf };
