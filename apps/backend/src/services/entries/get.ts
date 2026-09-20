import {
  assertSelector,
  loadCurrentContentPaths,
  type EntrySelector
} from "#backend/lib/content/paths";
import { assertRecordedContent } from "#backend/lib/schema/recorded";
import type { ContentSchemaMetadata } from "#backend/lib/schema/contract/recorded";
import { contents, entries, type Entry } from "#backend/db";
import {
  getContentBlocks,
  serializeContentDocument,
  type ContentBlocks,
  type ContentNode
} from "#backend/lib/content";
import { toCollectionID, toEntryID, toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { applyUpdate, Doc } from "yjs";
import { type ServiceResolveContext, withAuthorization } from "#backend/lib/policy";

interface EntryDetails extends Entry {
  path: string;
  schema: ContentSchemaMetadata | null;
  updatedAt: string;
  content: ContentNode;
  fragments: ContentBlocks["fragments"];
  properties: ContentBlocks["properties"];
}
interface GetEntryInput extends EntrySelector {
  expectedSchemaHash?: string;
}

type ResolvedGetEntry = Awaited<ReturnType<typeof resolveGetEntry>>;

async function resolveGetEntry({
  database,
  input,
  workspaceID
}: ServiceResolveContext<GetEntryInput>) {
  assertSelector(input.id, input.path);

  const paths = await loadCurrentContentPaths(database, workspaceID);
  const target = input.path !== undefined ? paths.resolveEntryPath(input.path) : null;
  const [row] = await database
    .select({
      id: entries.id,
      name: entries.name,
      rank: entries.rank,
      collectionID: entries.collectionID,
      contentState: contents.state,
      contentDocument: contents.document,
      contentUpdatedAt: contents.updatedAt,
      schemaRevisionID: contents.schemaRevisionID
    })
    .from(entries)
    .innerJoin(contents, eq(contents.entryID, entries.id))
    .where(
      and(
        input.id !== undefined ? eq(entries.id, toUUID(input.id)) : undefined,
        target ? eq(entries.name, target.name) : undefined,
        target
          ? target.collectionID
            ? eq(entries.collectionID, target.collectionID)
            : or(
                isNull(entries.collectionID),
                paths.rootID ? eq(entries.collectionID, paths.rootID) : undefined
              )
          : undefined,
        eq(entries.workspaceID, workspaceID),
        isNull(entries.deletedAt)
      )
    )
    .limit(1);

  if (!row) throw new ORPCError("NOT_FOUND");

  return {
    ...row,
    authorizationCollectionID: row.collectionID === paths.rootID ? null : row.collectionID,
    path: paths.entryPath(row.collectionID, row.name)
  };
}

const getEntry = withAuthorization<GetEntryInput, ResolvedGetEntry, EntryDetails>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "entry:read", collectionID: resolved.authorizationCollectionID }]
    }),
    transaction: "atomic",
    resolve: resolveGetEntry
  },
  async ({ database, input, resolved, workspaceID }) => {
    const document = new Doc();

    if (resolved.contentState) {
      applyUpdate(document, new Uint8Array(resolved.contentState));
    }

    const content = resolved.contentDocument || serializeContentDocument(document);
    document.destroy();

    const schema = await assertRecordedContent(database, workspaceID, {
      document: content,
      schemaRevisionID: resolved.schemaRevisionID,
      entryID: resolved.id,
      expectedSchemaHash: input.expectedSchemaHash
    });
    const { fragments, properties } = getContentBlocks(content);

    return {
      id: toEntryID(resolved.id),
      name: resolved.name,
      path: resolved.path,
      order: resolved.rank,
      collectionID: resolved.collectionID ? toCollectionID(resolved.collectionID) : undefined,
      updatedAt: resolved.contentUpdatedAt.toISOString(),
      content,
      schema,
      fragments,
      properties
    };
  }
);

export { getEntry };
export type { EntryDetails };
