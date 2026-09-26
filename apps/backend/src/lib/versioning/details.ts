import {
  type entryVersions,
  type DatabaseTransaction as Database
} from "@andesine/server/database";
import { mapVersion } from "@andesine/server/data";
import { assertRecordedContent } from "@andesine/server/schema";
import { type VersionDetails } from "@andesine/contracts/versions";

type EntryVersionRow = typeof entryVersions.$inferSelect;

const getVersionDetails = async (
  database: Database,
  row: EntryVersionRow,
  contributorIDs: string[],
  expectedSchemaHash?: string
): Promise<VersionDetails> => {
  const schema = await assertRecordedContent(database, row.workspaceID, {
    document: row.document,
    entryID: row.entryID,
    versionID: row.id,
    schemaRevisionID: row.schemaRevisionID,
    expectedSchemaHash
  });

  return mapVersion(row, contributorIDs, schema);
};

export { getVersionDetails };
