import { type ExtensionRequestParams } from "@andesine/contracts/extensions";
import { client } from "#web/lib/api";
import { ORPCError } from "@orpc/client";
import { setPageStorageKey } from "./page-availability";

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
  // A write can change which of the extension's pages are available.
  "storage.set": async (params: ExtensionRequestParams<"storage.set">) => {
    const result = await withStorageErrors(
      client.extensions.setStorageEntry({ extensionID, ...params })
    );

    setPageStorageKey(extensionID, params.key, true);

    return result;
  },
  "storage.delete": async (params: ExtensionRequestParams<"storage.delete">) => {
    const result = await withStorageErrors(
      client.extensions.deleteStorageEntry({ extensionID, ...params })
    );

    setPageStorageKey(extensionID, params.key, false);

    return result;
  },
  "storage.list": (params: ExtensionRequestParams<"storage.list">) => {
    return withStorageErrors(
      client.extensions.listStorageEntries({ extensionID, limit: 100, ...params })
    );
  }
});

export { ExtensionStorageError, createStoragePerformers };
