import { contentNodeType, type ContentNode } from "@andesine/document";
import { id } from "../primitives/id";
import {
  schemaDefinitionType,
  schemaDraftDefinitionType,
  type SchemaDefinition
} from "./definition";
import { resolvedSchemaDefinitionType, type ResolvedSchemaDefinition } from "./resolved";
import * as z from "zod";
import { versionReasonType, type VersionReason } from "../versions/index";

interface SchemaVersionSummary {
  id: string;
  schemaID: string;
  collectionID: string;
  version: number;
  hash: string;
  name: string | null;
  reason: VersionReason;
  sourceVersionID: string | null;
  active: boolean;
  appliedBy: string | null;
  contributorIDs: string[];
  createdAt: string;
  updatedAt: string;
}
interface SchemaVersionDetails extends SchemaVersionSummary {
  definition: SchemaDefinition;
  document: ContentNode;
}
interface LocalCollectionSchema {
  id: string;
  collectionID: string;
  enabled: boolean;
  draft: SchemaDefinition | null;
  draftDocument: ContentNode | null;
  draftHash: string | null;
  hasUnappliedChanges: boolean;
  activeVersion: SchemaVersionSummary | null;
  createdAt: string;
  updatedAt: string;
}
interface EffectiveCollectionSchema {
  id: string;
  collectionID: string;
  definition: ResolvedSchemaDefinition;
  document: ContentNode;
  hash: string;
  inherited: boolean;
  createdAt: string;
}
interface CollectionSchemaDetails {
  local: LocalCollectionSchema | null;
  effective: EffectiveCollectionSchema | null;
}
interface SchemaApplicationResult {
  changed: boolean;
  migrationID: string | null;
  schemaVersionID: string;
  affectedCollectionIDs: string[];
  totalEntries: number;
}
interface SchemaMigrationContentLossEntry {
  id: string;
  collectionID: string;
  name: string;
}
interface SchemaMigrationDetails {
  id: string;
  schemaID: string | null;
  schemaVersionID: string | null;
  status: SchemaMigrationStatus;
  totalEntries: number;
  processedEntries: number;
  error: string | null;
  initiatedBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
type SchemaMigrationStatus = z.infer<typeof schemaMigrationStatusType>;
const schemaVersionSummaryType = z.object({
  id: id().describe("ID of the schema version"),
  schemaID: id().describe("ID of the local collection schema"),
  collectionID: id().describe("ID of the collection"),
  version: z.number().int().positive().describe("Sequential schema version number"),
  hash: z.string().length(64).describe("Hash of the schema definition"),
  name: z.string().nullable().describe("Optional schema version name"),
  reason: versionReasonType.describe("Reason why the schema version was created"),
  sourceVersionID: id().nullable().describe("Source version used for a revert"),
  active: z.boolean().describe("Whether this is the active local schema version"),
  appliedBy: id().nullable().describe("Membership that applied the schema version"),
  contributorIDs: z.array(id()).describe("Memberships that contributed to the schema version"),
  createdAt: z.iso.datetime().describe("Time when the schema version was created"),
  updatedAt: z.iso.datetime().describe("Time when the schema version name was last updated")
});
const schemaVersionDetailsType = schemaVersionSummaryType.extend({
  definition: schemaDefinitionType.describe("Local schema definition stored in the version"),
  document: contentNodeType.describe("Schema definition projected as an editor document")
});
const localCollectionSchemaType = z.object({
  id: id().describe("ID of the local collection schema"),
  collectionID: id().describe("ID of the collection"),
  enabled: z.boolean().describe("Whether the collection currently defines a local schema"),
  draft: schemaDraftDefinitionType.nullable().describe("Current local schema draft"),
  draftDocument: contentNodeType
    .nullable()
    .describe("Current draft projected as an editor document"),
  draftHash: z.string().length(64).nullable().describe("Hash of the current local schema draft"),
  hasUnappliedChanges: z.boolean().describe("Whether the draft differs from the active version"),
  activeVersion: schemaVersionSummaryType.nullable(),
  createdAt: z.iso.datetime().describe("Time when the local schema was first created"),
  updatedAt: z.iso.datetime().describe("Time when the local schema draft was last updated")
});
const effectiveCollectionSchemaType = z.object({
  id: id().describe("ID of the effective schema revision"),
  collectionID: id().describe("ID of the collection"),
  definition: resolvedSchemaDefinitionType.describe("Effective inherited schema definition"),
  document: contentNodeType.describe("Effective schema projected as an editor document"),
  hash: z.string().length(64).describe("Hash of the effective schema definition"),
  inherited: z.boolean().describe("Whether the effective schema is fully inherited"),
  createdAt: z.iso.datetime().describe("Time when the effective revision was created")
});
const collectionSchemaDetailsType = z.object({
  local: localCollectionSchemaType.nullable(),
  effective: effectiveCollectionSchemaType.nullable()
});
const schemaApplicationResultType = z.object({
  changed: z.boolean().describe("Whether a new schema version was created for application"),
  migrationID: id()
    .nullable()
    .describe("ID of the migration, or null when entry conversion is not needed"),
  schemaVersionID: id().describe("ID of the schema version associated with the application"),
  affectedCollectionIDs: z.array(id()).describe("Collections affected by the effective schema"),
  totalEntries: z.number().int().nonnegative().describe("Entries that require content migration")
});
const schemaMigrationStatusType = z.enum([
  "queued",
  "running",
  "rolling_back",
  "completed",
  "failed"
]);
const schemaMigrationContentLossEntryType = z.object({
  id: id().describe("ID of an entry that lost content"),
  collectionID: id().describe("ID of the entry collection"),
  name: z.string().describe("Current entry name")
});
const schemaMigrationDetailsType = z.object({
  id: id().describe("ID of the schema migration"),
  schemaID: id().nullable().describe("Local schema that initiated the migration"),
  schemaVersionID: id().nullable().describe("Schema version applied by the migration"),
  status: schemaMigrationStatusType,
  totalEntries: z.number().int().nonnegative(),
  processedEntries: z.number().int().nonnegative(),
  error: z.string().nullable(),
  initiatedBy: id().nullable(),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});
export {
  collectionSchemaDetailsType,
  effectiveCollectionSchemaType,
  localCollectionSchemaType,
  schemaApplicationResultType,
  schemaMigrationContentLossEntryType,
  schemaMigrationDetailsType,
  schemaMigrationStatusType,
  schemaVersionDetailsType,
  schemaVersionSummaryType
};
export type {
  CollectionSchemaDetails,
  EffectiveCollectionSchema,
  LocalCollectionSchema,
  SchemaApplicationResult,
  SchemaMigrationContentLossEntry,
  SchemaMigrationDetails,
  SchemaMigrationStatus,
  SchemaVersionDetails,
  SchemaVersionSummary
};
