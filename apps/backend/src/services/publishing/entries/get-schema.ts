import { withPublicWorkspace } from "#backend/lib/policy";
import {
  loadPublishedEntryVersion,
  type PublishedEntryVersionInput
} from "#backend/lib/publishing/entry-version";
import { loadRecordedSchema } from "#backend/lib/schema/recorded";
import type { SchemaRevision } from "#backend/lib/schema/contract/recorded";

const getPublishedEntrySchema = withPublicWorkspace<
  PublishedEntryVersionInput,
  SchemaRevision | null
>({ transaction: "atomic" }, async ({ database, input, workspaceID }) => {
  const { version } = await loadPublishedEntryVersion(database, workspaceID, input);

  return loadRecordedSchema(database, workspaceID, {
    entryID: version.entryID,
    versionID: version.id,
    schemaRevisionID: version.schemaRevisionID
  });
});

export { getPublishedEntrySchema };
