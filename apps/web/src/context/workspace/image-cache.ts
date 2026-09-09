import {
  openWorkspaceDatabase,
  WORKSPACE_IMAGE_FILES_STORE_NAME as FILES,
  WORKSPACE_IMAGE_METADATA_STORE_NAME as METADATA
} from "./indexeddb";

interface CachedImageMetadata {
  id: string;
  entryIDs: string[];
  byteSize: number;
  lastViewedAt: number;
}

const IMAGE_CACHE_LIMIT = 256 * 1024 * 1024;
const readCachedImage = async (
  databaseName: string,
  entryID: string,
  assetID: string
): Promise<Blob | null> => {
  const database = await openWorkspaceDatabase(databaseName);

  if (!database) return null;

  try {
    const transaction = database.transaction([FILES, METADATA], "readwrite");
    const metadata: CachedImageMetadata | undefined = await transaction
      .objectStore(METADATA)
      .get(assetID);
    const file = metadata?.entryIDs.includes(entryID)
      ? ((await transaction.objectStore(FILES).get(assetID)) as Blob | undefined)
      : null;

    if (file && metadata)
      await transaction.objectStore(METADATA).put({ ...metadata, lastViewedAt: Date.now() });

    await transaction.done;
    return file || null;
  } finally {
    database.close();
  }
};
const cacheImage = async (
  databaseName: string,
  entryID: string,
  assetID: string,
  file: Blob,
  signal?: AbortSignal
): Promise<void> => {
  const database = await openWorkspaceDatabase(databaseName);

  if (!database) return;

  try {
    const transaction = database.transaction([FILES, METADATA], "readwrite");
    const store = transaction.objectStore(METADATA);
    const records: CachedImageMetadata[] = await store.getAll();

    if (signal?.aborted) {
      await transaction.done;
      return;
    }
    const existing = records.find(({ id }) => id === assetID);

    let total =
      file.size +
      records.filter(({ id }) => id !== assetID).reduce((sum, record) => sum + record.byteSize, 0);

    for (const record of records.sort((left, right) => left.lastViewedAt - right.lastViewedAt)) {
      if (total <= IMAGE_CACHE_LIMIT) break;
      if (record.id === assetID) continue;

      await store.delete(record.id);
      await transaction.objectStore(FILES).delete(record.id);
      total -= record.byteSize;
    }
    if (file.size <= IMAGE_CACHE_LIMIT) {
      await transaction.objectStore(FILES).put(file, assetID);
      await store.put({
        id: assetID,
        byteSize: file.size,
        entryIDs: [...new Set([...(existing?.entryIDs || []), entryID])],
        lastViewedAt: Date.now()
      } satisfies CachedImageMetadata);
    }
    await transaction.done;
  } finally {
    database.close();
  }
};
const pruneCachedImages = async (
  databaseName: string,
  canKeep: (entryID: string, assetID: string) => boolean
): Promise<void> => {
  const database = await openWorkspaceDatabase(databaseName);

  if (!database) return;

  try {
    const transaction = database.transaction([FILES, METADATA], "readwrite");
    const records: CachedImageMetadata[] = await transaction.objectStore(METADATA).getAll();

    for (const record of records) {
      const entryIDs = record.entryIDs.filter((entryID) => canKeep(entryID, record.id));

      if (!entryIDs.length) {
        await transaction.objectStore(METADATA).delete(record.id);
        await transaction.objectStore(FILES).delete(record.id);
      } else if (entryIDs.length !== record.entryIDs.length) {
        await transaction.objectStore(METADATA).put({ ...record, entryIDs });
      }
    }
    await transaction.done;
  } finally {
    database.close();
  }
};

export { cacheImage, pruneCachedImages, readCachedImage };
