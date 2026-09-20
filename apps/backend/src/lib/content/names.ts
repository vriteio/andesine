import { schemaMigrations } from "#backend/db/content-schemas";
import { collections } from "#backend/db/collections";
import { entries } from "#backend/db/entries";
import { toCollectionID } from "#backend/lib/primitives";
import {
  normalizeCollectionName,
  normalizeEntryName,
  MAX_CONTENT_NAME_LENGTH
} from "#backend/lib/validation/content-name";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

interface ContentNameInput {
  kind: "entry" | "collection";
  id?: string;
  parentID: string | null;
  name: string;
}

type NameDatabase = Pick<NodePgDatabase, "select">;

const contentNameConflict = (input: ContentNameInput) =>
  new ORPCError("CONTENT_NAME_CONFLICT", {
    status: 409,
    message: "An entry or collection already uses this name at this level",
    data: {
      name: input.name,
      parentID: input.parentID ? toCollectionID(input.parentID) : null,
      hints: [
        "Choose a different name or move the item to another collection. Names are case-sensitive and shared by entries and collections."
      ]
    }
  });
const getReservedContentNames = async (
  database: NameDatabase,
  workspaceID: string
): Promise<ContentNameInput[]> => {
  const migrations = await database
    .select({
      entryMove: schemaMigrations.entryMove,
      collectionMove: schemaMigrations.collectionMove
    })
    .from(schemaMigrations)
    .where(
      and(
        eq(schemaMigrations.workspaceID, workspaceID),
        inArray(schemaMigrations.status, ["queued", "running", "rolling_back"])
      )
    );
  const reserved: ContentNameInput[] = [];

  // Keep the source name available until a move migration can no longer roll back.
  for (const migration of migrations) {
    const entryMove = migration.entryMove;
    const collectionMove = migration.collectionMove;

    if (entryMove) {
      const [entry] = await database
        .select({ name: entries.name })
        .from(entries)
        .where(and(eq(entries.workspaceID, workspaceID), eq(entries.id, entryMove.entryID)));
      if (entry)
        reserved.push({
          kind: "entry",
          id: entryMove.entryID,
          parentID: entryMove.sourceCollectionID,
          name: entry.name
        });
    }

    if (collectionMove) {
      const [collection] = await database
        .select({ name: collections.name })
        .from(collections)
        .where(
          and(
            eq(collections.workspaceID, workspaceID),
            eq(collections.id, collectionMove.collectionID)
          )
        );
      if (collection)
        reserved.push({
          kind: "collection",
          id: collectionMove.collectionID,
          parentID: collectionMove.sourceParentID,
          name: collection.name
        });
    }
  }

  return reserved;
};
// Call within the workspace lock used by all current-tree writers.
const getSiblingNames = async (
  database: NameDatabase,
  workspaceID: string,
  input: ContentNameInput
): Promise<Set<string>> => {
  const [root] = await database
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(
        eq(collections.workspaceID, workspaceID),
        isNull(collections.parentID),
        isNull(collections.deletedAt)
      )
    );
  const parentID = input.parentID || root?.id;
  const rootLevel = parentID === root?.id;
  const siblingCollections = await database
    .select({ id: collections.id, name: collections.name })
    .from(collections)
    .where(
      and(
        eq(collections.workspaceID, workspaceID),
        parentID ? eq(collections.parentID, parentID) : isNull(collections.parentID),
        isNull(collections.deletedAt)
      )
    );
  const siblingEntries = await database
    .select({ id: entries.id, name: entries.name })
    .from(entries)
    .where(
      and(
        eq(entries.workspaceID, workspaceID),
        rootLevel
          ? or(isNull(entries.collectionID), root ? eq(entries.collectionID, root.id) : undefined)
          : input.parentID
            ? eq(entries.collectionID, input.parentID)
            : isNull(entries.collectionID),
        isNull(entries.deletedAt)
      )
    );

  const names = new Set(
    [
      ...siblingCollections.filter(({ id }) => input.kind !== "collection" || id !== input.id),
      ...siblingEntries.filter(({ id }) => input.kind !== "entry" || id !== input.id)
    ].map(({ name }) => name.normalize("NFC").trim())
  );
  const reserved = await getReservedContentNames(database, workspaceID);

  for (const item of reserved) {
    if (item.kind === input.kind && item.id === input.id) continue;
    if ((item.parentID || root?.id) === parentID) names.add(item.name);
  }

  return names;
};
const assertContentNameAvailable = async (
  database: NameDatabase,
  workspaceID: string,
  input: ContentNameInput
): Promise<void> => {
  const names = await getSiblingNames(database, workspaceID, input);

  if (names.has(input.name)) throw contentNameConflict(input);
};
const getAvailableContentName = async (
  database: NameDatabase,
  workspaceID: string,
  input: ContentNameInput
): Promise<string> => {
  const names = await getSiblingNames(database, workspaceID, input);
  let name = input.name;
  let number = 2;

  while (names.has(name)) {
    const suffix = ` (${number})`;
    let prefix = "";

    for (const character of input.name) {
      if (prefix.length + character.length > MAX_CONTENT_NAME_LENGTH - suffix.length) break;
      prefix += character;
    }

    name = `${prefix}${suffix}`;
    number += 1;
  }

  return name;
};
// Validate the final tree, so a multi-item restore can swap names in one transaction.
const assertContentTreeNames = async (
  database: NameDatabase,
  workspaceID: string
): Promise<void> => {
  const collectionRows = await database
    .select()
    .from(collections)
    .where(and(eq(collections.workspaceID, workspaceID), isNull(collections.deletedAt)));
  const entryRows = await database
    .select()
    .from(entries)
    .where(and(eq(entries.workspaceID, workspaceID), isNull(entries.deletedAt)));
  const rootID = collectionRows.find(({ parentID }) => parentID === null)?.id;
  const names = new Map<string, string>();
  const reserved = await getReservedContentNames(database, workspaceID);
  const items = [
    ...reserved,
    ...collectionRows
      .filter(({ parentID }) => parentID !== null)
      .map((row) => ({
        id: row.id,
        kind: "collection" as const,
        parentID: row.parentID,
        name: normalizeCollectionName(row.name)
      })),
    ...entryRows.map((row) => ({
      id: row.id,
      kind: "entry" as const,
      parentID: row.collectionID,
      name: normalizeEntryName(row.name)
    }))
  ];

  for (const item of items) {
    const parentID = item.parentID === rootID ? null : item.parentID;
    const key = JSON.stringify([parentID, item.name]);

    const owner = `${item.kind}:${item.id}`;

    if (names.has(key) && names.get(key) !== owner)
      throw contentNameConflict({ ...item, parentID });

    names.set(key, owner);
  }
};

export { assertContentNameAvailable, assertContentTreeNames, getAvailableContentName };
