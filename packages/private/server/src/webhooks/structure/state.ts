import {
  collections,
  entries,
  type DatabaseTransaction as Database
} from "@andesine/server/database";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";

interface WebhookStructureRow {
  kind: "entry" | "collection";
  id: string;
  parentID: string | null;
  name: string;
  rank: string;
  deletedAt: Date | null;
  restricted: boolean;
  publishingEnabled: boolean;
}
interface LoadWebhookStructureInput {
  database: Database;
  workspaceID: string;
  rootID: string;
  collectionIDs: string[];
  entryIDs: string[];
  includeCollectionEntries?: boolean;
}

const STRUCTURE_BATCH_SIZE = 250;
const loadWebhookStructure = async (
  input: LoadWebhookStructureInput
): Promise<WebhookStructureRow[]> => {
  const { database, workspaceID, collectionIDs, entryIDs } = input;
  const rows = new Map<string, WebhookStructureRow>();
  const loadEntries = async (ids: string[], byCollection: boolean): Promise<void> => {
    let cursor: string | undefined;

    while (true) {
      const page = await database
        .select({
          id: entries.id,
          parentID: entries.collectionID,
          name: entries.name,
          rank: entries.rank,
          deletedAt: entries.deletedAt
        })
        .from(entries)
        .where(
          and(
            eq(entries.workspaceID, workspaceID),
            or(
              inArray(byCollection ? entries.collectionID : entries.id, ids),
              byCollection && ids.includes(input.rootID) ? isNull(entries.collectionID) : undefined
            ),
            cursor ? gt(entries.id, cursor) : undefined
          )
        )
        .orderBy(entries.id)
        .limit(STRUCTURE_BATCH_SIZE);

      for (const row of page) {
        rows.set(`entry:${row.id}`, {
          ...row,
          kind: "entry",
          restricted: false,
          publishingEnabled: false
        });
      }

      if (page.length < STRUCTURE_BATCH_SIZE) break;

      cursor = page[page.length - 1]!.id;
    }
  };

  for (let offset = 0; offset < collectionIDs.length; offset += STRUCTURE_BATCH_SIZE) {
    const ids = collectionIDs.slice(offset, offset + STRUCTURE_BATCH_SIZE);
    const page = await database
      .select({
        id: collections.id,
        parentID: collections.parentID,
        name: collections.name,
        rank: collections.rank,
        deletedAt: collections.deletedAt,
        restricted: collections.restricted,
        publishingEnabled: collections.publishingEnabled
      })
      .from(collections)
      .where(and(eq(collections.workspaceID, workspaceID), inArray(collections.id, ids)));

    for (const row of page) rows.set(`collection:${row.id}`, { ...row, kind: "collection" });

    if (input.includeCollectionEntries) await loadEntries(ids, true);
  }

  for (let offset = 0; offset < entryIDs.length; offset += STRUCTURE_BATCH_SIZE) {
    await loadEntries(entryIDs.slice(offset, offset + STRUCTURE_BATCH_SIZE), false);
  }

  return [...rows.values()];
};

export { loadWebhookStructure, STRUCTURE_BATCH_SIZE };
export type { WebhookStructureRow };
