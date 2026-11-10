import { AndesineAPIError, type TypeMetadata } from "@andesine/sdk";
import { authenticatedClient } from "../auth/client";
import type { CommandContext } from "../context";
import type { TypesConfig } from "../config/schema";
import { CLIError, exitCodes } from "../errors";

/** Only metadata read failures can be retried by watch; writes and auth exchanges cannot. */
class RetryableMetadataError extends Error {
  constructor(
    readonly failure: unknown,
    readonly retryAfter = 0
  ) {
    super("Could not read type metadata.", { cause: failure });
  }
}

const retryDelay = (error: AndesineAPIError): number => {
  const header = error.response.headers.get("retry-after");

  if (!header) return 0;

  const seconds = Number(header);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();

  return Number.isFinite(delay) ? Math.max(0, delay) : 0;
};

/** Refresh credentials between polls and read the selected public metadata endpoint. */
const readMetadata = async (context: CommandContext, types: TypesConfig): Promise<TypeMetadata> => {
  const { config, signal } = context;

  if (process.env.ANDESINE_API_KEY === undefined && !config.workspaceID) {
    throw new CLIError(
      "No workspace selected. Run andesine init, pass --workspace <id>, or set ANDESINE_WORKSPACE_ID.",
      exitCodes.usage
    );
  }

  const { client } = await authenticatedClient(context);
  const input = {
    collections: types.collections,
    includeEntries: types.includeEntryIDs || types.includeEntryPaths || types.includeTree,
    includeTree: types.includeTree
  };
  const request = { signal, retries: 0 };

  let metadata: TypeMetadata;

  try {
    metadata =
      types.source.kind === "current"
        ? await client.typeMetadata.getCurrent(input, request)
        : await client.typeMetadata.getPublished(
            {
              ...input,
              ...("snapshotID" in types.source
                ? { snapshotID: types.source.snapshotID }
                : { channel: types.source.channel })
            },
            request
          );
  } catch (error) {
    signal.throwIfAborted();

    const transientAPIError =
      error instanceof AndesineAPIError &&
      (error.status === 408 ||
        error.status === 429 ||
        (error.status >= 500 && error.status !== 501) ||
        error.code === "SCHEMA_MIGRATION_IN_PROGRESS");
    const networkError =
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === "TimeoutError");

    if (transientAPIError || networkError) {
      throw new RetryableMetadataError(
        error,
        error instanceof AndesineAPIError ? retryDelay(error) : 0
      );
    }

    throw error;
  }

  if (config.workspaceID && config.workspaceID !== metadata.workspaceID) {
    throw new CLIError(
      "The API credential returned another workspace. Check --workspace and ANDESINE_API_KEY."
    );
  }

  return metadata;
};

export { readMetadata, RetryableMetadataError };
