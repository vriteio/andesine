import { AndesineAPIError, type createClient } from "@andesine/sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface ToolContext {
  client: AndesineClient;
  appURL: string;
  workspaceID?: string;
  semanticSearch: boolean;
  /** The connected client's name, known after initialization. */
  clientName: () => string;
  checkpoints: CheckpointStore;
}
/** Records which entries have a checkpoint version; claim is true only for the first edit. */
interface CheckpointStore {
  claim: (entryID: string) => Promise<boolean>;
}

type AndesineClient = ReturnType<typeof createClient>;

const COLLECTION_PAGE_SIZE = 100;

const toolResult = (value: Record<string, unknown>): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  structuredContent: value
});
/** API errors become tool results with the code, message, and hints, so agents can correct calls. */
const toolError = (error: unknown): CallToolResult => {
  const data =
    error instanceof AndesineAPIError && error.data && typeof error.data === "object"
      ? (error.data as Record<string, unknown>)
      : {};
  const { hints, ...details } = data;
  const message =
    error instanceof AndesineAPIError
      ? `${error.code}: ${error.message}`
      : error instanceof Error
        ? error.message
        : String(error);
  const lines = [
    message,
    ...(Array.isArray(hints) ? hints.map((hint) => `Hint: ${String(hint)}`) : []),
    ...(Object.keys(details).length ? [`Details: ${JSON.stringify(details)}`] : [])
  ];

  return { content: [{ type: "text", text: lines.join("\n") }], isError: true };
};
const runTool = <Input>(handler: (input: Input) => Promise<Record<string, unknown>>) => {
  return async (input: Input): Promise<CallToolResult> => {
    try {
      return toolResult(await handler(input));
    } catch (error) {
      return toolError(error);
    }
  };
};
/** An entry by ID (`ent_...`) or name path (`/...`), as the `entry` parameter of tools takes it. */
const entrySelector = (entry: string): { id: string } | { path: string } => {
  if (entry.startsWith("ent_")) return { id: entry };
  if (entry.startsWith("/")) return { path: entry };

  throw new Error(`Use an entry ID (ent_...) or a path that starts with /, not ${entry}`);
};
const resolveEntryID = async (context: ToolContext, entry: string): Promise<string> => {
  const selector = entrySelector(entry);

  if ("id" in selector) return selector.id;

  return (await context.client.entries.get({ path: selector.path })).id;
};
/** A collection target by ID (`coll_...`) or name path, where `/` is the top level. */
const collectionTarget = (collection: string) => {
  if (collection.startsWith("coll_")) return { collectionID: collection };
  if (collection.startsWith("/")) return { collectionPath: collection };

  throw new Error(`Use a collection ID (coll_...) or a path that starts with /, not ${collection}`);
};
const resolveCollectionID = async (context: ToolContext, collection: string): Promise<string> => {
  if (collection.startsWith("coll_")) return collection;

  const collectionPath = collectionTarget(collection).collectionPath!;
  const parentPath = collectionPath.replace(/\/[^/]+\/?$/, "") || "/";

  let cursor: string | undefined;

  do {
    const page = await context.client.collections.list({
      collectionPath: parentPath,
      cursor,
      limit: COLLECTION_PAGE_SIZE
    });
    const match = page.data.find(({ path }) => path === collectionPath);

    if (match) return match.id;

    cursor = page.pagination.nextCursor ?? undefined;
  } while (cursor);

  throw new Error(`Collection ${collection} not found`);
};
const entryURL = (context: ToolContext, entryID: string): string | undefined => {
  return context.workspaceID ? `${context.appURL}/${context.workspaceID}/${entryID}` : undefined;
};
const createMemoryCheckpointStore = (): CheckpointStore => {
  const entryIDs = new Set<string>();

  return {
    claim: async (entryID) => {
      const first = !entryIDs.has(entryID);

      entryIDs.add(entryID);

      return first;
    }
  };
};
/**
 * Saves a version once per session and entry, before the first edit, so people can restore
 * the content from before an agent's changes. Skipped without the versions permission.
 */
const saveCheckpoint = async (context: ToolContext, entryID: string): Promise<void> => {
  if (!(await context.checkpoints.claim(entryID))) return;

  await context.client.versions
    .create({ entryID, name: `Before ${context.clientName()} edits`.slice(0, 100) })
    .catch(() => undefined);
};

export {
  collectionTarget,
  createMemoryCheckpointStore,
  entrySelector,
  entryURL,
  resolveCollectionID,
  resolveEntryID,
  runTool,
  saveCheckpoint,
  toolError
};
export type { AndesineClient, CheckpointStore, ToolContext };
