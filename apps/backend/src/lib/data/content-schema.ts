import {
  type collectionSchemas,
  type effectiveSchemaRevisions,
  type schemaMigrations,
  type schemaVersions
} from "@andesine/server/database";
import { createSchemaEditorDocument } from "@andesine/server/schema";
import {
  type SchemaVersionSummary,
  type SchemaVersionDetails,
  type LocalCollectionSchema,
  type EffectiveCollectionSchema,
  type SchemaMigrationDetails,
  type ResolvedSchemaDefinition
} from "@andesine/contracts/schema";
import {
  toCollectionID,
  toMembershipID,
  toSchemaID,
  toSchemaMigrationID,
  toSchemaRevisionID,
  toSchemaVersionID
} from "@andesine/contracts/primitives";

interface MapLocalCollectionSchemaInput {
  row: CollectionSchemaRow;
  activeVersion: SchemaVersionSummary | null;
}

type CollectionSchemaRow = typeof collectionSchemas.$inferSelect;
type EffectiveSchemaRevisionRow = typeof effectiveSchemaRevisions.$inferSelect;
type SchemaMigrationRow = typeof schemaMigrations.$inferSelect;

type SchemaVersionRow = typeof schemaVersions.$inferSelect;

const mapResolvedSchemaDefinition = (
  definition: ResolvedSchemaDefinition
): ResolvedSchemaDefinition => ({
  ...definition,
  fields: definition.fields.map((field) => ({
    ...field,
    source: {
      ...field.source,
      collectionID: toCollectionID(field.source.collectionID),
      schemaID: toSchemaID(field.source.schemaID),
      versionID: toSchemaVersionID(field.source.versionID)
    }
  })),
  sourceVersionIDs: definition.sourceVersionIDs.map(toSchemaVersionID)
});
const mapSchemaVersionSummary = (
  row: SchemaVersionRow,
  collectionID: string,
  contributorIDs: string[]
): SchemaVersionSummary => ({
  id: toSchemaVersionID(row.id),
  schemaID: toSchemaID(row.schemaID),
  collectionID: toCollectionID(collectionID),
  version: row.version,
  hash: row.hash,
  name: row.name,
  reason: row.reason,
  sourceVersionID: row.sourceVersionID ? toSchemaVersionID(row.sourceVersionID) : null,
  active: row.active,
  appliedBy: row.appliedBy ? toMembershipID(row.appliedBy) : null,
  contributorIDs: contributorIDs.map(toMembershipID),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});
const mapSchemaVersion = (
  row: SchemaVersionRow,
  collectionID: string,
  contributorIDs: string[]
): SchemaVersionDetails => ({
  ...mapSchemaVersionSummary(row, collectionID, contributorIDs),
  definition: row.definition,
  document: createSchemaEditorDocument(row.definition)
});
const toSchemaVersionSummary = ({
  definition: _definition,
  document: _document,
  ...version
}: SchemaVersionDetails): SchemaVersionSummary => version;
const mapLocalCollectionSchema = ({
  row,
  activeVersion
}: MapLocalCollectionSchemaInput): LocalCollectionSchema => ({
  id: toSchemaID(row.id),
  collectionID: toCollectionID(row.collectionID),
  enabled: row.enabled,
  draft: row.draftDocument,
  draftDocument: row.draftDocument ? createSchemaEditorDocument(row.draftDocument) : null,
  draftHash: row.draftHash,
  hasUnappliedChanges: Boolean(
    row.draftHash && (!activeVersion || row.draftHash !== activeVersion.hash)
  ),
  activeVersion,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});
const mapEffectiveCollectionSchema = (
  row: EffectiveSchemaRevisionRow,
  inherited: boolean
): EffectiveCollectionSchema => {
  const definition = mapResolvedSchemaDefinition(row.definition);

  return {
    id: toSchemaRevisionID(row.id),
    collectionID: toCollectionID(row.collectionID),
    definition,
    document: createSchemaEditorDocument(definition),
    hash: row.hash,
    inherited,
    createdAt: row.createdAt.toISOString()
  };
};
const mapSchemaMigration = (row: SchemaMigrationRow): SchemaMigrationDetails => ({
  id: toSchemaMigrationID(row.id),
  schemaID: row.schemaID ? toSchemaID(row.schemaID) : null,
  schemaVersionID: row.schemaVersionID ? toSchemaVersionID(row.schemaVersionID) : null,
  status: row.status,
  totalEntries: row.totalEntries,
  processedEntries: row.processedEntries,
  error: row.error,
  initiatedBy: row.initiatedBy ? toMembershipID(row.initiatedBy) : null,
  startedAt: row.startedAt?.toISOString() || null,
  completedAt: row.completedAt?.toISOString() || null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export {
  mapEffectiveCollectionSchema,
  mapLocalCollectionSchema,
  mapSchemaMigration,
  mapSchemaVersion,
  mapSchemaVersionSummary,
  toSchemaVersionSummary
};
