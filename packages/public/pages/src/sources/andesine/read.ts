import {
  AndesineAPIError,
  createClient,
  paginatePages,
  type PublishedEntryContent,
  type PublishedTree
} from "@andesine/sdk";
import { getSecret } from "astro:env/server";
import type { AndesineSourceConfig } from "../../config";

interface Publication {
  tree: PublishedTree;
  entries: PublishedEntryContent[];
}

/** Returns the API key from the environment of the build or the server, through the adapter. */
const getAPIKey = (source: AndesineSourceConfig): string => {
  const key = getSecret(source.apiKeyEnv);

  if (!key) {
    throw new Error(
      `Source "${source.id}": set ${source.apiKeyEnv}. Never use a PUBLIC_ variable for the key.`
    );
  }

  return key;
};
const toReadError = (source: AndesineSourceConfig, error: unknown): Error => {
  const label = `Source "${source.id}"`;

  if (!(error instanceof AndesineAPIError)) {
    // Keep request URLs, keys, and upstream bodies out of messages.
    return new Error(`${label}: the Andesine read failed. Check the connection and try again.`);
  }

  if (error.status === 404) {
    return new Error(`${label}: no publication found. Check the collection ID, then publish it.`);
  }

  if (error.status === 401 || error.status === 403) {
    return new Error(`${label}: the API key cannot read published content.`);
  }

  if (error.code === "CONTENT_SCHEMA_INVALID" || error.code === "CONTENT_SCHEMA_MISMATCH") {
    return new Error(`${label}: published content does not match its schema (${error.code}).`);
  }

  return new Error(`${label}: the Andesine read failed (${error.status}, ${error.code}).`);
};
/**
 * Reads the latest publication of a collection, or only the entry that `select` returns. All
 * reads use the tree's snapshot, so the tree and the entries always agree.
 */
const readPublication = async (
  source: AndesineSourceConfig,
  signal?: AbortSignal,
  select?: (tree: PublishedTree) => string | undefined
): Promise<Publication> => {
  const client = createClient({ baseURL: source.apiURL, apiKey: getAPIKey(source) });
  const entries: PublishedEntryContent[] = [];

  try {
    const tree = await client.content.getTree(
      { collectionID: source.collection, channel: "published" },
      { signal }
    );
    const snapshot = client.atSnapshot(tree.snapshotID);
    const entryID = select?.(tree);

    if (select) {
      return { tree, entries: entryID ? [await snapshot.get({ entryID }, { signal })] : [] };
    }

    for await (const page of paginatePages((cursor) => {
      return snapshot.listEntries(
        {
          collectionID: source.collection,
          descendants: true,
          includeContent: true,
          limit: 100,
          cursor
        },
        { signal }
      );
    })) {
      entries.push(...page.data);
    }

    return { tree, entries };
  } catch (error) {
    throw toReadError(source, error);
  }
};

export { getAPIKey, readPublication };
export type { Publication };
