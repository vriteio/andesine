import { type entryVersions } from "@andesine/server/database";
import { type VersionSummary, type VersionDetails } from "@andesine/contracts/versions";
import { type ContentSchemaMetadata } from "@andesine/contracts/schema";
import { toEntryID, toMembershipID, toVersionID } from "@andesine/contracts/primitives";

type EntryVersionRow = typeof entryVersions.$inferSelect;

const mapVersionSummary = (row: EntryVersionRow, contributorIDs: string[]): VersionSummary => {
  return {
    id: toVersionID(row.id),
    entryID: toEntryID(row.entryID),
    entryName: row.entryName,
    hash: row.hash,
    name: row.name,
    reason: row.reason,
    sourceVersionID: row.sourceVersionID ? toVersionID(row.sourceVersionID) : null,
    contributorIDs: contributorIDs.map(toMembershipID),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
};
const mapVersion = (
  row: EntryVersionRow,
  contributorIDs: string[],
  schema: ContentSchemaMetadata | null
): VersionDetails => {
  return {
    ...mapVersionSummary(row, contributorIDs),
    schema,
    document: row.document
  };
};

export { mapVersion, mapVersionSummary };
