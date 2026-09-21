import type { TypeMetadata, TypeMetadataCollection } from "@andesine/sdk";
import { literal, tuple } from "./source";

interface MetadataHierarchy {
  collections: Map<string | null, TypeMetadataCollection>;
  descendants: Map<string | null, string[]>;
}

/** Build selected subtrees. Missing parents are valid for a selected or restricted subtree. */
const hierarchy = (metadata: TypeMetadata): MetadataHierarchy => {
  const collections = new Map(
    metadata.collections.map((collection) => [collection.id, collection])
  );
  const children = new Map<string | null, TypeMetadataCollection[]>();
  const descendants = new Map<string | null, string[]>();
  const visiting = new Set<string | null>();
  const visit = (id: string | null): string[] => {
    if (visiting.has(id)) throw new Error("Type metadata contains a collection cycle.");
    if (descendants.has(id)) return descendants.get(id)!;

    visiting.add(id);

    const result = (children.get(id) ?? []).flatMap((child) => [child.id!, ...visit(child.id)]);

    visiting.delete(id);
    descendants.set(id, result);

    return result;
  };

  if (collections.size !== metadata.collections.length) {
    throw new Error("Type metadata contains duplicate collection IDs.");
  }

  for (const collection of metadata.collections) {
    if (collection.id === null) continue;

    const siblings = children.get(collection.parentID) ?? [];

    siblings.push(collection);
    children.set(collection.parentID, siblings);
  }

  for (const collection of metadata.collections) visit(collection.id);

  return { collections, descendants };
};

/** Emit ordered tree tuples without content bodies or runtime values. */
const treeTypes = (metadata: TypeMetadata, collectionNames: Map<string, string>): string[] => {
  const entries = new Map(metadata.entries!.map((entry) => [entry.id, entry]));
  const collections = new Map(
    metadata.collections.map((collection) => [collection.id, collection])
  );
  const rows = new Map(metadata.tree!.map((row) => [row.collectionID, row]));

  return metadata.collections.map((collection) => {
    const name = `${collectionNames.get(collection.id ?? "/")}Tree`;
    const row = rows.get(collection.id);

    if (!row) throw new Error(`Missing tree metadata for ${literal(collection.path)}.`);

    const childTrees = row.collectionIDs.map((id) => {
      const child = collections.get(id);

      if (!child || child.parentID !== collection.id) {
        throw new Error(`Invalid tree collection reference ${literal(id)}.`);
      }

      return `${collectionNames.get(id)}Tree`;
    });
    const childEntries = row.entryIDs.map((id) => {
      const entry = entries.get(id);

      if (!entry || entry.collectionID !== collection.id) {
        throw new Error(`Invalid tree entry reference ${literal(id)}.`);
      }

      return `Omit<SDK.PublishedEntry, "id" | "name" | "path"> & { id: ${literal(id)}; name: ${literal(entry.name)}; path: ${literal(entry.path)} }`;
    });

    if (metadata.source.kind === "current") {
      return `export interface ${name} {
  collectionID: ${literal(collection.id)};
  collectionIDs: ${tuple(row.collectionIDs.map(literal))};
  entryIDs: ${tuple(row.entryIDs.map(literal))};
}`;
    }

    return `export interface ${name} extends SDK.PublishedCollection {
  id: ${literal(collection.id)};
  name: ${literal(collection.name)};
  path: ${literal(collection.path)};
  entries: ${tuple(childEntries)};
  collections: ${tuple(childTrees)};
}`;
  });
};

export { hierarchy, treeTypes };
