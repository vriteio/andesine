import { contents, entries } from "@andesine/server/database";
import {
  hashContentDocument,
  resolveEntrySlugID,
  loadCurrentContentPaths,
  serializeContentDocument
} from "@andesine/server/content";
import { assertRecordedContent } from "@andesine/server/schema";
import {
  getContentBlocks,
  normalizeContentElements,
  type ContentBlocks,
  type ContentNode
} from "@andesine/document";
import { assertSelector, type EntrySelector } from "@andesine/contracts/content";
import { type ContentSchemaMetadata } from "@andesine/contracts/schema";
import { type Entry } from "@andesine/contracts/entities";
import { toCollectionID, toEntryID, toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { applyUpdate, Doc } from "yjs";
import { type ServiceResolveContext, withAuthorization } from "#backend/lib/policy";
import {
  encodeEntryMDX,
  getContentBlockDetails,
  loadEntryReferences,
  withEntryLinkPaths,
  type ContentBlockDetails,
  type EntryReferences
} from "#backend/lib/content";
import { getOpenDocumentContent } from "#backend/collaboration";

interface EntryDetails extends Entry {
  path: string;
  slugPath: string;
  schema: ContentSchemaMetadata | null;
  updatedAt: string;
  hash: string;
  content: ContentNode;
  fragments: ContentBlocks["fragments"];
  properties: ContentBlocks["properties"];
  mdx?: string;
  blocks?: ContentBlockDetails[];
  references: EntryReferences;
}
interface GetEntryInput extends EntrySelector {
  expectedSchemaHash?: string;
  format?: "json" | "mdx" | "blocks";
}

type ResolvedGetEntry = Awaited<ReturnType<typeof resolveGetEntry>>;

async function resolveGetEntry({
  database,
  input,
  workspaceID
}: ServiceResolveContext<GetEntryInput>) {
  assertSelector([input.id, input.path, input.slugPath]);

  const paths = await loadCurrentContentPaths(database, workspaceID);
  const target = input.path !== undefined ? paths.resolveEntryPath(input.path) : null;
  const slugEntryID =
    input.slugPath !== undefined
      ? await resolveEntrySlugID(database, workspaceID, paths, input.slugPath)
      : undefined;
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
        slugEntryID ? eq(entries.id, slugEntryID) : undefined,
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
    path: paths.entryPath(row.collectionID, row.name),
    slugPath: paths.entrySlugPath(row.collectionID, row.name, row.id)
  };
}

const getStoredContent = (resolved: ResolvedGetEntry): ContentNode => {
  const document = new Doc();

  if (resolved.contentState) applyUpdate(document, new Uint8Array(resolved.contentState));

  // Normalized as live snapshots are, so the hash matches the one that writes compare against.
  const content = normalizeContentElements(
    resolved.contentDocument || serializeContentDocument(document)
  );

  document.destroy();

  return content;
};
const getEntry = withAuthorization<GetEntryInput, ResolvedGetEntry, EntryDetails>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "entry:read", collectionID: resolved.authorizationCollectionID }]
    }),
    transaction: "atomic",
    tree: true,
    resolve: resolveGetEntry
  },
  async ({ authorization, database, input, resolved, workspaceID }) => {
    // An open document has edits that aren't saved yet; content writes compare against it.
    const loaded = await getOpenDocumentContent(toEntryID(resolved.id), workspaceID);
    const content = loaded?.document ?? getStoredContent(resolved);

    const schema = await assertRecordedContent(database, workspaceID, {
      document: content,
      schemaRevisionID: resolved.schemaRevisionID,
      entryID: resolved.id,
      expectedSchemaHash: input.expectedSchemaHash
    });
    const { fragments, properties } = getContentBlocks(content);
    const references = await loadEntryReferences(database, workspaceID, content, authorization);
    const linkedContent = withEntryLinkPaths(content, references);

    return {
      id: toEntryID(resolved.id),
      name: resolved.name,
      path: resolved.path,
      slugPath: resolved.slugPath,
      order: resolved.rank,
      collectionID: resolved.collectionID ? toCollectionID(resolved.collectionID) : undefined,
      updatedAt: resolved.contentUpdatedAt.toISOString(),
      hash: loaded?.hash ?? hashContentDocument(content),
      content,
      schema,
      fragments,
      properties,
      references,
      ...(input.format === "mdx" && { mdx: await encodeEntryMDX(linkedContent) }),
      ...(input.format === "blocks" && { blocks: await getContentBlockDetails(linkedContent) })
    };
  }
);

export { getEntry };
export type { EntryDetails };
