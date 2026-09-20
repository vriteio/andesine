import type { entryVersions } from "#backend/db/versions";
import type { db } from "#backend/lib/adapters/postgres";
import { mapVersion, type VersionDetails } from "#backend/lib/data/entry-version";
import { assertRecordedContent } from "#backend/lib/schema/recorded";

type Database = Parameters<Parameters<typeof db.transaction>[0]>[0];
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
