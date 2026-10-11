import { toEntryID, toUUID } from "@andesine/contracts/primitives";
import { type AuthorizedServiceInput } from "#backend/lib/policy";
import { prepareSchemaMigrationConnections } from "#backend/collaboration";
import { submitSchemaMigration } from "#backend/lib/queue";
import {
  planEntryMove,
  type MoveEntryInput,
  type MoveEntryResult
} from "#backend/lib/content/entry-move";

const moveEntry = async (
  input: MoveEntryInput & AuthorizedServiceInput
): Promise<MoveEntryResult> => {
  const result = await planEntryMove(input);

  await submitSchemaMigration({
    ...result.schemaMigration,
    prepareAffectedContent: () => {
      return prepareSchemaMigrationConnections(
        result.schemaMigration.affectedCollectionIDs,
        result.collectionChanged ? [toEntryID(toUUID(input.id))] : []
      );
    },
    workspaceID: input.auth.workspaceID
  });

  return result;
};

export { moveEntry };
