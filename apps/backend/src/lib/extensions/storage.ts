import { toUUID } from "@andesine/contracts/primitives";
import { extensions, type DatabaseClient } from "@andesine/server/database";
import { type SessionData } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { isVisibleExtension } from "./installed";

interface StorageOwnerInput {
  database: DatabaseClient;
  auth: SessionData;
  workspaceID: string;
  /** Members name the extension; the extension backend always uses its own. */
  extensionID?: string;
  /** Locks the extension row, which serializes quota checks. */
  lock?: boolean;
}

/** The UTF-8 size of the JSON value; the entry size adds the key. */
const getStorageValueSize = (value: unknown): number => {
  return Buffer.byteLength(JSON.stringify(value));
};
/** The UUID of the active extension whose storage the caller uses; members need it visible. */
const getStorageOwner = async (input: StorageOwnerInput): Promise<string> => {
  const isExtension = input.auth.type === "extension";
  const extensionID = isExtension ? input.auth.extension!.extensionID : input.extensionID;

  if (!extensionID) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

  const query = input.database
    .select({ id: extensions.id })
    .from(extensions)
    .where(
      and(
        eq(extensions.id, toUUID(extensionID)),
        eq(extensions.workspaceID, input.workspaceID),
        eq(extensions.enabled, true),
        isNull(extensions.disabledReason),
        isNull(extensions.uninstalledAt),
        isExtension ? undefined : isVisibleExtension(input.auth)
      )
    );
  const [extension] = input.lock ? await query.for("update") : await query;

  if (!extension) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

  return extension.id;
};

export { getStorageValueSize, getStorageOwner };
