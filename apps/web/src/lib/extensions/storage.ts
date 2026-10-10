import { type ExtensionRequestParams } from "@andesine/contracts/extensions";
import { client } from "#web/lib/api";
import { ORPCError } from "@orpc/client";

/** A storage request the server rejected; its fixed message goes back to the extension. */
class ExtensionStorageError extends Error {}

const STORAGE_ERRORS = new Set(["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND"]);

const withStorageErrors = async <T>(request: Promise<T>): Promise<T> => {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ORPCError && STORAGE_ERRORS.has(error.code)) {
      throw new ExtensionStorageError(error.message);
    }

    throw error;
  }
};
const createStoragePerformers = (extensionID: string) => ({
  "storage.get": async ({ key }: ExtensionRequestParams<"storage.get">) => {
    try {
      return await client.extensions.getStorageEntry({ extensionID, key });
    } catch (error) {
      if (error instanceof ORPCError && error.code === "NOT_FOUND") return null;

      throw error;
    }
  },
  "storage.set": (params: ExtensionRequestParams<"storage.set">) => {
    return withStorageErrors(client.extensions.setStorageEntry({ extensionID, ...params }));
  },
  "storage.delete": (params: ExtensionRequestParams<"storage.delete">) => {
    return withStorageErrors(client.extensions.deleteStorageEntry({ extensionID, ...params }));
  },
  "storage.list": (params: ExtensionRequestParams<"storage.list">) => {
    return withStorageErrors(
      client.extensions.listStorageEntries({ extensionID, limit: 100, ...params })
    );
  }
});

export { ExtensionStorageError, createStoragePerformers };
