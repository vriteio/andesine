import * as Y from "yjs";
import { client } from "#web/lib/api";
import {
  WORKSPACE_ENTRY_ID_INDEX_NAME,
  WORKSPACE_ENTRY_STATES_STORE_NAME,
  WORKSPACE_UPDATES_STORE_NAME,
  openWorkspaceDatabase
} from "./indexeddb";
import type { PersistedUpdate } from "./y-indexeddb";

interface PreloadedEntryState {
  id: string;
  hash: string;
}

const fromBase64 = (value: string): Uint8Array => {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
};
/**
 * Caches the stored states of entries that changed since their last preload, so that they open
 * without waiting for the connection; the connection then syncs what came after.
 */
const preloadEntryStates = async (databaseName: string, entryIDs: string[]): Promise<void> => {
  if (!entryIDs.length) return;

  const database = await openWorkspaceDatabase(databaseName);

  if (!database) return;

  try {
    const preloaded = await Promise.all(
      entryIDs.map((id) => {
        return database.get(WORKSPACE_ENTRY_STATES_STORE_NAME, id) as Promise<
          PreloadedEntryState | undefined
        >;
      })
    );
    const { entries } = await client.sync.getEntryStates({
      entries: entryIDs.map((id, index) => ({ id, hash: preloaded[index]?.hash }))
    });

    if (!entries.length) return;

    const transaction = database.transaction(
      [WORKSPACE_UPDATES_STORE_NAME, WORKSPACE_ENTRY_STATES_STORE_NAME],
      "readwrite"
    );
    const updatesStore = transaction.objectStore(WORKSPACE_UPDATES_STORE_NAME);
    const updatesIndex = updatesStore.index(WORKSPACE_ENTRY_ID_INDEX_NAME);

    // Merged into one record, so repeated preloads don't add full copies of the entry.
    for (const entry of entries) {
      const [keys, cached] = await Promise.all([
        updatesIndex.getAllKeys(entry.id),
        updatesIndex.getAll(entry.id) as Promise<PersistedUpdate[]>
      ]);
      const update = Y.mergeUpdates([
        ...cached.map(({ update }) => update),
        fromBase64(entry.state)
      ]);

      for (const key of keys) {
        void updatesStore.delete(key);
      }

      void updatesStore.add({ entryID: entry.id, update } satisfies PersistedUpdate);
      void transaction
        .objectStore(WORKSPACE_ENTRY_STATES_STORE_NAME)
        .put({ id: entry.id, hash: entry.hash } satisfies PreloadedEntryState);
    }

    await transaction.done;
  } finally {
    database.close();
  }
};

export { preloadEntryStates };
