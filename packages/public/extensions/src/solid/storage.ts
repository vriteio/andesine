import { type JSONValue } from "./protocol";
import { request } from "./requests";

interface StorageEntry<T extends JSONValue = JSONValue> {
  key: string;
  value: T;
  /** An ISO date-time. */
  updatedAt: string;
}
interface StorageListOptions {
  /** Only keys that start with the prefix. */
  prefix?: string;
  /** Entries after this key, from the previous page. */
  after?: string;
  /** At most 100 (the default). */
  limit?: number;
}
interface StoragePage {
  data: StorageEntry[];
  hasMore: boolean;
}

/**
 * JSON key-value storage shared with the backend; the last write wins.
 * Limits: 256-character keys, 128 KiB values, 10,000 entries, and 10 MiB in total.
 */
const storage = {
  /** The entry, or null when the key is not set. */
  async get<T extends JSONValue = JSONValue>(key: string): Promise<StorageEntry<T> | null> {
    return ((await request("storage.get", { key })) ?? null) as StorageEntry<T> | null;
  },
  /** Creates or replaces an entry; resolves with its update time. */
  async set(key: string, value: JSONValue): Promise<{ updatedAt: string }> {
    const { updatedAt } = (await request("storage.set", { key, value })) as { updatedAt: string };

    return { updatedAt };
  },
  /** Resolves with whether the key was set. */
  async delete(key: string): Promise<boolean> {
    const { deleted } = (await request("storage.delete", { key })) as { deleted: boolean };

    return deleted;
  },
  /** Entries in key order; a page can have fewer entries than `limit` when values are large. */
  async list(options: StorageListOptions = {}): Promise<StoragePage> {
    return (await request("storage.list", { ...options })) as unknown as StoragePage;
  }
};

export { storage };
export type { StorageEntry, StorageListOptions, StoragePage };
