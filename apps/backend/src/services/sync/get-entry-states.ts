import { contents, entries } from "@andesine/server/database";
import { withAuthorization } from "#backend/lib/policy";
import { toCollectionID, toEntryID, toUUID } from "@andesine/contracts/primitives";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

interface GetEntryStatesInput {
  entries: Array<{ id: string; hash?: string }>;
}
interface EntryState {
  id: string;
  hash: string;
  state: string;
}
interface GetEntryStatesResult {
  entries: EntryState[];
}

const MAX_STATES = 50;
const MAX_STATE_BYTES = 1_000_000;
const MAX_TOTAL_BYTES = 5_000_000;

/**
 * Stored states of readable entries that changed from the client's hash, the most recently
 * updated first, for the client to cache ahead of opening them. Large entries are left out.
 */
const getEntryStates = withAuthorization<GetEntryStatesInput, undefined, GetEntryStatesResult>(
  { tree: true },
  async ({ authorization, database, input, workspaceID }) => {
    const clientHashes = new Map(input.entries.map(({ id, hash }) => [id, hash]));

    if (!clientHashes.size) return { entries: [] };

    const candidates = await database
      .select({
        id: entries.id,
        collectionID: entries.collectionID,
        hash: contents.hash,
        size: sql<number>`octet_length(${contents.state})`
      })
      .from(entries)
      .innerJoin(
        contents,
        and(eq(contents.workspaceID, entries.workspaceID), eq(contents.entryID, entries.id))
      )
      .where(
        and(
          eq(entries.workspaceID, workspaceID),
          isNull(entries.deletedAt),
          isNotNull(contents.state),
          isNotNull(contents.hash),
          inArray(entries.id, [...clientHashes.keys()].map(toUUID))
        )
      )
      .orderBy(desc(contents.updatedAt));

    const selectedIDs: string[] = [];

    let totalSize = 0;

    for (const candidate of candidates) {
      const collectionID = candidate.collectionID ? toCollectionID(candidate.collectionID) : null;
      const changed = clientHashes.get(toEntryID(candidate.id)) !== candidate.hash;
      const fits =
        candidate.size <= MAX_STATE_BYTES && totalSize + candidate.size <= MAX_TOTAL_BYTES;

      if (selectedIDs.length === MAX_STATES) break;
      if (!changed || !fits || !authorization.canEntry(collectionID, "entry:read")) continue;

      selectedIDs.push(candidate.id);
      totalSize += candidate.size;
    }

    if (!selectedIDs.length) return { entries: [] };

    const states = await database
      .select({ id: contents.entryID, hash: contents.hash, state: contents.state })
      .from(contents)
      .where(and(eq(contents.workspaceID, workspaceID), inArray(contents.entryID, selectedIDs)));

    return {
      entries: states.flatMap(({ id, hash, state }) => {
        return hash && state
          ? [{ id: toEntryID(id), hash, state: Buffer.from(state).toString("base64") }]
          : [];
      })
    };
  }
);

export { getEntryStates };
