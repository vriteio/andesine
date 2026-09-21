import type { TypeMetadata, TypeMetadataInput } from "#backend/contracts/schemas/type-metadata";
import type { createContentPaths } from "#backend/lib/content/paths";
import type { SchemaRevision } from "#backend/lib/schema/contract/recorded";
import { hashSchemaValue } from "#backend/lib/schema/contract/hash";
import { toCollectionID, toEntryID, toSchemaRevisionID } from "#backend/lib/primitives";
import type { MetadataCollectionSource } from "./selection";

interface MetadataSchemaAssociation {
  collectionID: string | null;
  schemaRevisionID: string | null;
}
interface MetadataEntrySource extends MetadataSchemaAssociation {
  id: string;
  name: string;
  rank: string;
}
interface MetadataResultInput {
  workspaceID: string;
  source: TypeMetadata["source"];
  options: TypeMetadataInput;
  paths: ReturnType<typeof createContentPaths>;
  collections: MetadataCollectionSource[];
  associations: MetadataSchemaAssociation[];
  revisions: SchemaRevision[];
  entries: MetadataEntrySource[];
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const collectionID = (id: string | null): string | null => (id ? toCollectionID(id) : null);
const revisionID = (id: string | null): string | null => (id ? toSchemaRevisionID(id) : null);

/** Fingerprint only type-relevant data; publication and content-only changes do not cause churn. */
const createMetadataResult = (input: MetadataResultInput): TypeMetadata => {
  const schemasByCollection = new Map<string | null, Set<string | null>>();

  for (const association of input.associations) {
    const schemas = schemasByCollection.get(association.collectionID) ?? new Set<string | null>();

    schemas.add(revisionID(association.schemaRevisionID));
    schemasByCollection.set(association.collectionID, schemas);
  }

  const collections = input.collections
    .map((row) => ({
      id: collectionID(row.id),
      parentID: collectionID(row.parentID),
      name: row.name,
      path: input.paths.collectionPath(row.id),
      schemaRevisionIDs: [...(schemasByCollection.get(row.id) ?? [])].sort((a, b) =>
        compare(a ?? "", b ?? "")
      )
    }))
    .sort((a, b) => compare(a.id ?? "", b.id ?? ""));
  const revisions = [...input.revisions].sort((a, b) => compare(a.revisionID, b.revisionID));
  const entries =
    input.options.includeEntries || input.options.includeTree
      ? input.entries
          .map((row) => ({
            id: toEntryID(row.id),
            collectionID: collectionID(row.collectionID),
            name: row.name,
            path: input.paths.entryPath(row.collectionID, row.name),
            schemaRevisionID: revisionID(row.schemaRevisionID)
          }))
          .sort((a, b) => compare(a.id, b.id))
      : undefined;
  const orderedCollections = [...input.collections].sort(
    (a, b) => compare(a.rank, b.rank) || compare(a.id ?? "", b.id ?? "")
  );
  const orderedEntries = [...input.entries].sort(
    (a, b) => compare(a.rank, b.rank) || compare(a.id, b.id)
  );
  const children = new Map<string | null, { collectionIDs: string[]; entryIDs: string[] }>();

  if (input.options.includeTree) {
    for (const row of input.collections)
      children.set(collectionID(row.id), { collectionIDs: [], entryIDs: [] });
    for (const row of orderedCollections) {
      if (row.id) {
        children.get(collectionID(row.parentID))?.collectionIDs.push(toCollectionID(row.id));
      }
    }
    for (const row of orderedEntries)
      children.get(collectionID(row.collectionID))?.entryIDs.push(toEntryID(row.id));
  }

  const tree = input.options.includeTree
    ? collections.map(({ id }) => ({ collectionID: id, ...children.get(id)! }))
    : undefined;
  const data = { collections, revisions, ...(entries && { entries }), ...(tree && { tree }) };

  return {
    formatVersion: 1,
    workspaceID: input.workspaceID,
    source: input.source,
    fingerprint: hashSchemaValue({
      formatVersion: 1,
      workspaceID: input.workspaceID,
      kind: input.source.kind,
      ...data
    }),
    ...data
  };
};

export { createMetadataResult };
export type { MetadataSchemaAssociation, MetadataEntrySource };
