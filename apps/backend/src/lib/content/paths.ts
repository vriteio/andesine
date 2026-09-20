import { collections } from "#backend/db/collections";
import { publishingSnapshotCollections } from "#backend/db/publishing";
import { publicID, toUUID } from "#backend/lib/primitives";
import { MAX_CONTENT_NAME_LENGTH } from "#backend/lib/validation/content-name";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

interface CollectionPathRow {
  id: string;
  name: string;
  parentID: string | null;
}
interface CollectionSelector {
  collectionID?: string;
  collectionPath?: string;
}
interface EntrySelector {
  id?: string;
  path?: string;
}
interface PublishedEntrySelector {
  entryID?: string;
  path?: string;
}
interface ParsedContentPath {
  anchorID: string | null;
  segments: string[];
}

type PathDatabase = Pick<NodePgDatabase, "select">;

const invalidPath = () => {
  return new ORPCError("BAD_REQUEST", {
    message: "Invalid content path",
    data: {
      hints: [
        "Use /Docs/Page or coll_ID/Page with decoded names. Do not use empty segments, trailing slashes, single-dot segments or double-dot segments. Use / to select the root collection."
      ]
    }
  });
};
const parseContentPath = (path: string): ParsedContentPath => {
  const absolute = path.startsWith("/");
  const parts = path.split("/");
  const anchor = parts.shift()!;
  const segments = path === "/" ? [] : parts.map((part) => part.normalize("NFC").trim());

  if (
    (!absolute && !publicID("coll").safeParse(anchor).success) ||
    segments.some(
      (part) => !part || part === "." || part === ".." || part.length > MAX_CONTENT_NAME_LENGTH
    )
  )
    throw invalidPath();

  return { anchorID: absolute ? null : toUUID(anchor), segments };
};
const assertSelector = (
  id: string | undefined,
  path: string | undefined,
  required = true
): void => {
  if (
    (id !== undefined && path !== undefined) ||
    (required && id === undefined && path === undefined)
  ) {
    throw new ORPCError("BAD_REQUEST", {
      message: required
        ? "Use exactly one ID or path selector"
        : "Use an ID or path selector, not both"
    });
  }
};
const createContentPaths = (rows: CollectionPathRow[], rootID?: string) => {
  const collectionsByID = new Map(
    rows
      .filter((row) => row.id !== rootID)
      .map((row) => [row.id, { ...row, parentID: row.parentID === rootID ? null : row.parentID }])
  );
  const childrenByName = new Map<string, string>();
  const paths = new Map<string, string>();
  const parentKey = (parentID: string | null, name: string) => JSON.stringify([parentID, name]);

  for (const row of collectionsByID.values())
    childrenByName.set(parentKey(row.parentID, row.name), row.id);

  const collectionPath = (id: string | null): string => {
    if (!id || id === rootID) return "/";
    if (paths.has(id)) return paths.get(id)!;

    const names: string[] = [];
    const visited = new Set<string>();
    let current: string | null = id;

    while (current) {
      const row = collectionsByID.get(current);

      if (!row || visited.has(current))
        throw new ORPCError("NOT_FOUND", { message: "Collection path is unavailable" });
      visited.add(current);
      names.unshift(row.name);
      current = row.parentID;
    }

    const path = `/${names.join("/")}`;

    paths.set(id, path);
    return path;
  };
  const resolveSegments = (parsed: ParsedContentPath): string | null => {
    let parentID = parsed.anchorID === rootID ? null : parsed.anchorID;

    if (parentID && !collectionsByID.has(parentID)) throw new ORPCError("NOT_FOUND");

    for (const name of parsed.segments) {
      const child = childrenByName.get(parentKey(parentID, name));

      if (!child) throw new ORPCError("NOT_FOUND");
      parentID = child;
    }

    return parentID;
  };
  const resolveCollection = (
    input: CollectionSelector,
    required = true
  ): string | null | undefined => {
    assertSelector(input.collectionID, input.collectionPath, required);
    if (input.collectionPath !== undefined)
      return resolveSegments(parseContentPath(input.collectionPath));
    if (input.collectionID !== undefined)
      return resolveSegments({ anchorID: toUUID(input.collectionID), segments: [] });
    return undefined;
  };
  const resolveEntryPath = (path: string) => {
    const parsed = parseContentPath(path);
    const name = parsed.segments.pop();

    if (!name) throw invalidPath();

    return { collectionID: resolveSegments(parsed), name };
  };
  const entryPath = (collectionID: string | null, name: string): string =>
    `${collectionPath(collectionID).replace(/\/$/, "")}/${name}`;

  const descendantIDs = (id: string | null): string[] => {
    const result: string[] = [];
    const pending = [id];
    const seen = new Set<string | null>(pending);
    const children = new Map<string | null, string[]>();

    for (const row of collectionsByID.values()) {
      const siblings = children.get(row.parentID) || [];

      siblings.push(row.id);
      children.set(row.parentID, siblings);
    }
    for (let index = 0; index < pending.length; index++) {
      for (const child of children.get(pending[index]) || []) {
        if (seen.has(child)) continue;

        seen.add(child);
        result.push(child);
        pending.push(child);
      }
    }

    return result;
  };

  return { collectionPath, entryPath, resolveCollection, resolveEntryPath, descendantIDs, rootID };
};
const loadCurrentContentPaths = async (database: PathDatabase, workspaceID: string) => {
  const rows = await database
    .select({ id: collections.id, name: collections.name, parentID: collections.parentID })
    .from(collections)
    .where(and(eq(collections.workspaceID, workspaceID), isNull(collections.deletedAt)));

  return createContentPaths(rows, rows.find(({ parentID }) => parentID === null)?.id);
};
const loadPublishedContentPaths = async (
  database: PathDatabase,
  workspaceID: string,
  snapshotID: string
) => {
  const rows = await database
    .select({
      id: publishingSnapshotCollections.collectionID,
      name: publishingSnapshotCollections.name,
      parentID: publishingSnapshotCollections.parentID
    })
    .from(publishingSnapshotCollections)
    .where(
      and(
        eq(publishingSnapshotCollections.workspaceID, workspaceID),
        eq(publishingSnapshotCollections.snapshotID, snapshotID)
      )
    );

  return createContentPaths(rows);
};

export {
  assertSelector,
  createContentPaths,
  loadCurrentContentPaths,
  loadPublishedContentPaths,
  parseContentPath
};
export type { CollectionSelector, EntrySelector, PublishedEntrySelector };
