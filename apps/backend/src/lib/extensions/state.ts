import { type ExtensionStateResult } from "@andesine/contracts/extensions";
import { toExtensionID, toUUID } from "@andesine/contracts/primitives";
import { extensions, type DatabaseClient } from "@andesine/server/database";
import { type SessionData } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { isVisibleExtension } from "./installed";

type ExtensionState = "active" | "disabled" | "uninstalled";

const getExtensionState = (extension: typeof extensions.$inferSelect): ExtensionState => {
  if (extension.uninstalledAt) return "uninstalled";

  return extension.enabled && !extension.disabledReason ? "active" : "disabled";
};

const toExtensionStateResult = (
  extension: typeof extensions.$inferSelect
): ExtensionStateResult => {
  const state = getExtensionState(extension);

  return {
    id: toExtensionID(extension.id),
    state,
    disabledReason: state === "disabled" ? (extension.disabledReason ?? "manual") : null,
    revision: extension.revision
  };
};
const lockManagedExtension = async (
  database: DatabaseClient,
  auth: SessionData,
  workspaceID: string,
  extensionID: string,
  expectedRevision: number
): Promise<typeof extensions.$inferSelect> => {
  const [extension] = await database
    .select()
    .from(extensions)
    .where(
      and(
        eq(extensions.id, toUUID(extensionID)),
        eq(extensions.workspaceID, workspaceID),
        isNull(extensions.uninstalledAt),
        isVisibleExtension(auth)
      )
    )
    .for("update");

  if (!extension) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

  if (extension.revision !== expectedRevision) {
    throw new ORPCError("CONFLICT", { message: "The extension changed. Reload and try again." });
  }

  return extension;
};

/** Development changes need no revision, only the developer's ownership. */
const lockDevelopmentExtension = async (
  database: DatabaseClient,
  workspaceID: string,
  extensionID: string,
  memberID: string
): Promise<typeof extensions.$inferSelect> => {
  const [extension] = await database
    .select()
    .from(extensions)
    .where(
      and(
        eq(extensions.id, toUUID(extensionID)),
        eq(extensions.workspaceID, workspaceID),
        eq(extensions.developerID, toUUID(memberID)),
        isNull(extensions.uninstalledAt)
      )
    )
    .for("update");

  if (!extension) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

  return extension;
};

export {
  getExtensionState,
  toExtensionStateResult,
  lockManagedExtension,
  lockDevelopmentExtension
};
export type { ExtensionState };
