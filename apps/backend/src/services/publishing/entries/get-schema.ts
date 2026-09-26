import { loadRecordedSchema } from "@andesine/server/schema";
import { withPublicWorkspace } from "#backend/lib/policy";
import {
  loadPublishedEntryVersion,
  type PublishedEntryVersionInput
} from "#backend/lib/publishing/entry-version";
import { type SchemaRevision } from "@andesine/contracts/schema";

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
