import type { DatabaseTransaction as Database } from "#backend/lib/adapters/postgres";
import { toCollectionID, toUUID, toWorkspaceID } from "#backend/lib/primitives/id";
import { loadWebhookScopeIndex } from "../scope";
import { createWebhookOperation, type WebhookOperation } from "../operation";
import { createWebhookRecorder } from "../recorder";
import type { WebhookEventChange } from "../recording-context";
import { getWebhookStructureChanges } from "./changes";
import { loadWebhookStructure } from "./state";

interface CreateStructureWebhookRecorderInput {
  database: Database;
  workspaceID: string;
  collectionIDs: string[];
  entryIDs?: string[];
  includeDescendants?: boolean;
  operation?: WebhookOperation;
}
interface StructureWebhookRecorder {
  operation: WebhookOperation;
  record: () => Promise<void>;
}

// Internal database IDs are accepted here. Capture before any structure writes and
// record once after all related writes, in the same workspace-locked transaction.
const createStructureWebhookRecorder = async (
  input: CreateStructureWebhookRecorderInput
): Promise<StructureWebhookRecorder> => {
  const { database } = input;
  const workspaceID = toUUID(input.workspaceID);
  const operation = input.operation ?? createWebhookOperation(toWorkspaceID(workspaceID));

  if (operation.workspaceID !== toWorkspaceID(workspaceID)) {
    throw new Error("Webhook operation belongs to another workspace");
  }

  const recorder = await createWebhookRecorder({ database, operation });
  const roots = new Set(input.collectionIDs.map((id) => toCollectionID(toUUID(id))));
  const collectionIDs = new Set(input.collectionIDs.map(toUUID));

  if (input.includeDescendants) {
    for (const collection of recorder.before.collections.values()) {
      const affected =
        roots.has(recorder.before.rootID) || collection.ancestors.some((id) => roots.has(id));

      if (affected) collectionIDs.add(toUUID(collection.id));
    }
  }

  const selection = {
    database,
    workspaceID,
    rootID: toUUID(recorder.before.rootID),
    collectionIDs: [...collectionIDs],
    entryIDs: [...new Set((input.entryIDs ?? []).map(toUUID))]
  };
  const before = await loadWebhookStructure({
    ...selection,
    includeCollectionEntries: input.includeDescendants
  });
  const beforeByID = new Map(before.map((row) => [`${row.kind}:${row.id}`, row]));
  const entryIDs = [
    ...new Set([
      ...selection.entryIDs,
      ...before.filter(({ kind }) => kind === "entry").map(({ id }) => id)
    ])
  ];
  let recorded = false;

  const record = async (): Promise<void> => {
    if (recorded) throw new Error("Structure webhook changes were already recorded");

    recorded = true;

    const after = await loadWebhookStructure({ ...selection, entryIDs });
    const afterIndex = await loadWebhookScopeIndex({
      database,
      workspaceID: operation.workspaceID,
      includeDeleted: true
    });
    const occurredAt = new Date();
    const afterIDs = new Set(after.map((row) => `${row.kind}:${row.id}`));

    if (before.some((row) => !afterIDs.has(`${row.kind}:${row.id}`))) {
      throw new Error("Structure recording cannot follow physical deletion");
    }

    function* changes(): Generator<WebhookEventChange> {
      for (const row of after) {
        yield* getWebhookStructureChanges({
          before: beforeByID.get(`${row.kind}:${row.id}`),
          after: row,
          beforeIndex: recorder.before,
          afterIndex,
          operation,
          occurredAt
        });
      }
    }

    await recorder.record(changes());
  };

  return { operation, record };
};

export { createStructureWebhookRecorder };
