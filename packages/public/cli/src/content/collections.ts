import { paginate, type AndesineClient } from "@andesine/sdk";
import type { TypesConfig } from "../config/schema";

interface CollectionChoice {
  id: string;
  path: string;
}

/** Read selectable collections from one published snapshot, or the current tree. */
const listCollections = async (
  client: AndesineClient,
  source: TypesConfig["source"],
  signal: AbortSignal
): Promise<CollectionChoice[]> => {
  const collections: CollectionChoice[] = [];

  if (source.kind === "published") {
    const { kind: _, ...selector } = source;

    for await (const collection of client.content.paginateCollections(selector, { signal })) {
      collections.push(collection);
    }
  } else {
    const queue: Array<string | undefined> = [undefined];
    const seen = new Set<string>();

    for (const collectionID of queue) {
      const scope = collectionID ? { collectionID } : {};

      for await (const collection of paginate((cursor) =>
        client.collections.list({ ...scope, cursor, limit: 100 }, { signal })
      )) {
        if (seen.has(collection.id)) continue;

        seen.add(collection.id);
        collections.push(collection);
        queue.push(collection.id);
      }
    }
  }

  return collections.sort((a, b) => a.path.localeCompare(b.path));
};

/** Let the public API resolve IDs and paths, including collection-ID anchors. */
const validateCollections = async (
  client: AndesineClient,
  source: TypesConfig["source"],
  selectors: string[],
  signal: AbortSignal
): Promise<void> => {
  let snapshotID =
    source.kind === "published" && "snapshotID" in source ? source.snapshotID : undefined;

  for (const selector of selectors.length ? selectors : [undefined]) {
    const scope =
      selector === undefined
        ? {}
        : /^coll_[A-Za-z\d]+$/.test(selector)
          ? { collectionID: selector }
          : { collectionPath: selector };

    if (source.kind === "current") {
      await client.collections.list({ ...scope, limit: 1 }, { signal });
    } else {
      const publication = snapshotID
        ? { snapshotID }
        : { channel: "channel" in source ? source.channel : undefined };
      const page = await client.content.listCollections(
        { ...scope, ...publication, limit: 1 },
        { signal }
      );

      snapshotID = page.snapshotID;
    }
  }
};

export { listCollections, validateCollections };
export type { CollectionChoice };
