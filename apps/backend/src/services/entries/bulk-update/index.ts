import { contents, entries, entryVersions } from "@andesine/server/database";
import { assertContentNameAvailable, loadCurrentContentPaths } from "@andesine/server/content";
import { createWebhookOperation } from "@andesine/server/webhooks/recording";
import {
  applyContentOperations,
  assertExpectedValue,
  contentHashMismatchError,
  decodeEntryMDX,
  getMDXImageURLs,
  getOperationSources,
  loadEntryReferences,
  prepareEntryContent,
  setContentTitle,
  withEntryLinkPaths,
  withItemIndex,
  type ContentOperation,
  type ContentPaths,
  type ImageAssetIDs
} from "#backend/lib/content";
import { Asset } from "#backend/services/assets";
import {
  openDocumentContentConnection,
  readDocumentContent,
  type ContentConnection
} from "#backend/collaboration";
import { LiveContentChanges, type PreparedItem, type StaleItem } from "./live-content";
import { Versions } from "#backend/services/versions";
import { toCollectionID, toEntryID, toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import { toContentSlug } from "@andesine/sdk/slug";
import { type VersionDetails } from "@andesine/contracts/versions";
import { getContentTitle, type ContentNode } from "@andesine/document";
import { normalizeEntryName } from "@andesine/contracts/content";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import {
  getUserAuthorization,
  withAuthorization,
  type AuthorizedServiceContext,
  type AuthorizedCollectionTree
} from "#backend/lib/policy";

interface BulkUpdateItem {
  id: string;
  name?: string;
  document?: ContentNode;
  mdx?: string;
  operations?: ContentOperation[];
  expectedHash?: string;
  expectedName?: string;
  version?: { name?: string };
}
interface BulkUpdateEntriesInput {
  items: BulkUpdateItem[];
  contributorIDs: string[];
}
interface CommitBulkUpdateInput extends BulkUpdateEntriesInput {
  connections: ContentConnection[];
  imageAssetIDs: Array<ImageAssetIDs | undefined>;
  /** Filled with the live changes, so the caller can undo them when the transaction fails. */
  liveChanges: LiveContentChanges;
}
interface BulkUpdateEntry {
  id: string;
  name: string;
  collectionID: string | null;
  schemaRevisionID: string | null;
}
interface BulkUpdateItemResult {
  id: string;
  hash: string;
  version?: VersionDetails;
}
interface BulkUpdateEntriesResult {
  createdVersions: VersionDetails[];
  items: BulkUpdateItemResult[];
  /**
   * Set when entries kept a change after a live edit stopped the call. Their recovery versions
   * are committed and in createdVersions; throw it after handling them.
   */
  error?: unknown;
}

type BulkUpdateContext = AuthorizedServiceContext<CommitBulkUpdateInput, BulkUpdateEntry[]> & {
  authorization: AuthorizedCollectionTree;
};

const MAX_ATTEMPTS = 3;

const getUpdatedDocument = async (
  item: BulkUpdateItem,
  previous: ContentNode,
  imageAssetIDs?: ImageAssetIDs
): Promise<ContentNode> => {
  if (item.document) return item.document;
  if (item.mdx !== undefined) return decodeEntryMDX(item.mdx, previous, imageAssetIDs);

  const document = await applyContentOperations(previous, item.operations ?? [], imageAssetIDs);

  return item.name === undefined ? document : setContentTitle(document, item.name);
};
/** Reads and checks an item without changes, so a retry after a live edit starts clean. */
const prepareItem = async (
  context: BulkUpdateContext,
  index: number,
  names: Map<string, string>,
  paths: ContentPaths
): Promise<PreparedItem> => {
  const { authorization, database, input, resolved, workspaceID } = context;
  const item = input.items[index];
  const entry = resolved[index];
  const connection = input.connections[index];
  const expectedName =
    item.expectedName === undefined ? undefined : normalizeEntryName(item.expectedName);
  const previous = await readDocumentContent(connection);
  const staleHash = item.expectedHash !== undefined && previous.hash !== item.expectedHash;

  assertExpectedValue("name", expectedName, entry.name);

  if (staleHash) throw contentHashMismatchError(previous.hash);

  // MDX and operations see entry links as paths, as entries.get shows them.
  const references = await loadEntryReferences(
    database,
    workspaceID,
    previous.document,
    authorization,
    paths
  );
  const document = await getUpdatedDocument(
    item,
    withEntryLinkPaths(previous.document, references),
    input.imageAssetIDs[index]
  );
  const content = await prepareEntryContent(database, workspaceID, {
    authorization,
    entryID: item.id,
    schemaRevisionID: entry.schemaRevisionID,
    document,
    paths
  });
  const name = normalizeEntryName(getContentTitle(content.document));
  const nameKey = `${entry.collectionID ?? ""}:${name.toLocaleLowerCase()}`;
  const replacesContent = item.document !== undefined || item.mdx !== undefined;

  if (name !== entry.name) {
    // Names change on save, so two items of the call can't take the same name.
    if (names.has(nameKey)) {
      throw new ORPCError("CONTENT_NAME_CONFLICT", {
        status: 409,
        message: `Item ${names.get(nameKey)} of the call already uses this name`,
        data: {
          name,
          slug: toContentSlug(name, toEntryID(entry.id)),
          parentID: entry.collectionID ? toCollectionID(entry.collectionID) : null
        }
      });
    }

    names.set(nameKey, String(index));
    await assertContentNameAvailable(database, workspaceID, {
      kind: "entry",
      id: toUUID(item.id),
      parentID: entry.collectionID,
      name
    });
  }

  const [existing] = await database
    .select({ id: entryVersions.id })
    .from(entryVersions)
    .where(
      and(
        eq(entryVersions.workspaceID, workspaceID),
        eq(entryVersions.entryID, toUUID(item.id)),
        eq(entryVersions.hash, previous.hash)
      )
    )
    .limit(1);
  const replacesUnsavedContent = replacesContent && !existing && previous.hash !== content.hash;

  return { content, previous, replacesUnsavedContent };
};
const saveItemRecords = async (
  context: BulkUpdateContext,
  index: number,
  prepared: PreparedItem,
  recoveryOnly = false
): Promise<VersionDetails[]> => {
  const { auth, authorizationScope, input, resolved } = context;
  const item = input.items[index];
  const { content, previous, replacesUnsavedContent } = prepared;
  const versions: VersionDetails[] = [];

  await Asset.grantContent({
    auth,
    entryID: item.id,
    document: content.document,
    previousDocument: previous.document,
    skipAuthorization: authorizationScope
  });

  // Replaced content without a version stays recoverable.
  if (replacesUnsavedContent) {
    versions.push(
      await Versions.createFromSnapshot({
        auth,
        entryID: item.id,
        reason: "auto",
        contributorIDs: input.contributorIDs,
        snapshot: previous,
        skipAuthorization: authorizationScope
      })
    );
  }

  if (item.version && !recoveryOnly) {
    const { state: _state, ...snapshot } = content;

    versions.push(
      await Versions.createFromSnapshot({
        auth,
        entryID: item.id,
        reason: "manual",
        contributorIDs: input.contributorIDs,
        name: item.version.name,
        schemaRevisionID: resolved[index].schemaRevisionID,
        snapshot,
        skipAuthorization: authorizationScope
      })
    );
  }

  return versions;
};
/**
 * Keeps the records of entries that kept a change after a live edit stopped the call: their
 * replaced content stays recoverable. The error is thrown after the commit.
 */
const commitUnrestored = async (
  context: BulkUpdateContext,
  prepared: PreparedItem[],
  stale: StaleItem
): Promise<BulkUpdateEntriesResult> => {
  const { input } = context;
  const createdVersions: VersionDetails[] = [];

  for (const { index } of stale.unrestored) {
    createdVersions.push(...(await saveItemRecords(context, index, prepared[index], true)));
  }

  const changedIDs = stale.unrestored.map(({ index }) => input.items[index].id);
  const error = withItemIndex(
    contentHashMismatchError(stale.hash, changedIDs),
    stale.index,
    input.items.length
  );

  return { createdVersions, items: [], error };
};
const commitBulkUpdate = withAuthorization<
  CommitBulkUpdateInput,
  BulkUpdateEntry[],
  BulkUpdateEntriesResult
>(
  {
    actions: ({ input, resolved }) => ({
      entries: input.items.flatMap((item, index) => {
        const { collectionID } = resolved[index];

        return [
          { action: "entry:update" as const, collectionID },
          ...(item.version ? [{ action: "version:create" as const, collectionID }] : [])
        ];
      })
    }),
    resolve: async ({ database, input, workspaceID }) => {
      const ids = input.items.map(({ id }) => toUUID(id));
      const rows = await database
        .select({
          id: entries.id,
          name: entries.name,
          collectionID: entries.collectionID,
          schemaRevisionID: contents.schemaRevisionID
        })
        .from(entries)
        .innerJoin(contents, eq(contents.entryID, entries.id))
        .where(
          and(
            inArray(entries.id, ids),
            eq(entries.workspaceID, workspaceID),
            isNull(entries.deletedAt)
          )
        )
        .for("update", { of: entries });
      const rowsByID = new Map(rows.map((row) => [row.id, row]));

      return ids.map((id, index) => {
        const row = rowsByID.get(id);

        if (!row) throw new ORPCError("NOT_FOUND", { message: `Item ${index}: entry not found` });

        return row;
      });
    },
    transaction: "locked-workspace",
    tree: true
  },
  async (context) => {
    const { database, input, workspaceID } = context;
    const { liveChanges } = input;
    // The workspace is locked, so collection paths don't change during the call.
    const paths = await loadCurrentContentPaths(database, workspaceID);

    for (let attempt = 1; ; attempt += 1) {
      const names = new Map<string, string>();
      const prepared: PreparedItem[] = [];

      for (const index of input.items.keys()) {
        try {
          prepared.push(await prepareItem(context, index, names, paths));
        } catch (error) {
          throw withItemIndex(error, index, input.items.length);
        }
      }

      // Checked for all items before any changes, so a live edit changes nothing.
      const currentHashes = await Promise.all(
        input.connections.map(async (connection) => (await readDocumentContent(connection)).hash)
      );
      const staleIndex = currentHashes.findIndex((hash, index) => {
        return hash !== prepared[index].previous.hash;
      });
      const createdVersions: VersionDetails[] = [];
      const results: BulkUpdateItemResult[] = [];

      // Restored here while the workspace is locked, so editor saves can't store the change first.
      try {
        const stale =
          staleIndex === -1
            ? await liveChanges.apply(prepared)
            : { index: staleIndex, hash: currentHashes[staleIndex], unrestored: [] };
        // A failed restore leaves an item changed, and a retry would apply the change again.
        const retry =
          stale !== null &&
          !stale.unrestored.length &&
          attempt < MAX_ATTEMPTS &&
          input.items.every(({ expectedHash }) => expectedHash === undefined);

        if (retry) continue;

        if (stale?.unrestored.length) {
          return await commitUnrestored(context, prepared, stale);
        }

        if (stale) {
          throw withItemIndex(
            contentHashMismatchError(stale.hash),
            stale.index,
            input.items.length
          );
        }

        for (const { index, hash } of liveChanges.applied) {
          const versions = await saveItemRecords(context, index, prepared[index]);

          createdVersions.push(...versions);
          results.push({
            id: input.items[index].id,
            hash,
            version: input.items[index].version ? versions[versions.length - 1] : undefined
          });
        }
      } catch (error) {
        await liveChanges.restore();
        throw error;
      }

      return { createdVersions, items: results };
    }
  }
);

/**
 * Writes content (and names through titles) of many entries in one workspace lock. All items
 * are prepared and checked before any content changes; operations without `expectedHash` are
 * applied again after a live edit.
 */
const bulkUpdateEntries = withAuthorization<
  BulkUpdateEntriesInput,
  undefined,
  BulkUpdateEntriesResult
>({}, async ({ auth, input, workspaceID }) => {
  const ids = input.items.map(({ id }) => toUUID(id));
  const connections: ContentConnection[] = [];
  const liveChanges = new LiveContentChanges(
    connections,
    createWebhookOperation(toWorkspaceID(workspaceID)).id
  );

  if (new Set(ids).size !== ids.length) {
    throw new ORPCError("BAD_REQUEST", { message: "Update each entry once per call" });
  }

  // Before the transaction: downloads are slow, and the images must be ready.
  const imageAssetIDs = await Promise.all(
    input.items.map(async (item) => {
      const urls = await getMDXImageURLs([
        ...(item.mdx === undefined ? [] : [item.mdx]),
        ...getOperationSources(item.operations ?? [])
      ]);

      return urls.length ? Asset.importContentImages({ auth, entryID: item.id, urls }) : undefined;
    })
  );

  try {
    for (const item of input.items) {
      connections.push(
        await openDocumentContentConnection(item.id, workspaceID, {
          contributorID: getUserAuthorization(auth)?.memberID
        })
      );
    }

    return await commitBulkUpdate({ ...input, auth, connections, imageAssetIDs, liveChanges });
  } catch (error) {
    // After a failed commit; items that the transaction restored are already forgotten.
    await liveChanges.restore();
    throw error;
  } finally {
    await Promise.all(connections.map((connection) => connection.disconnect()));
  }
});

export { bulkUpdateEntries };
export type { BulkUpdateItem };
