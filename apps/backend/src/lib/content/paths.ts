import { toContentSlug } from "@andesine/sdk/slug";
import { entries } from "#backend/db/entries";
import { entryVersions } from "#backend/db/versions";
import { collections } from "#backend/db/collections";
import { publishingSnapshotCollections, publishingSnapshotEntries } from "#backend/db/publishing";
import { publicID, toUUID, toCollectionID, toEntryID } from "#backend/lib/primitives";
import { MAX_CONTENT_NAME_LENGTH } from "#backend/lib/validation/content-name";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

interface CollectionPathRow {
  id: string;
  name: string;
  parentID: string | null;
}
interface CollectionSelector {
  collectionID?: string;
  collectionPath?: string;
  collectionSlugPath?: string;
}
interface EntrySelector {
  id?: string;
  path?: string;
  slugPath?: string;
}
interface PublishedEntrySelector {
  entryID?: string;
  path?: string;
  slugPath?: string;
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
        "Use /Docs/Page with decoded names, or /docs/page with decoded slugs. Both support a coll_ID/ anchor. Do not use empty segments, trailing slashes, single-dot segments or double-dot segments. Use / to select the root collection."
      ]
    }
  });
};
const parseContentPath = (path: string, slug = false): ParsedContentPath => {
  const absolute = path.startsWith("/");
  const parts = path.split("/");
  const anchor = parts.shift()!;
  const segments = path === "/" ? [] : parts.map((part) => part.normalize("NFC").trim());

  if (
    (!absolute && !publicID("coll").safeParse(anchor).success) ||
    segments.some((part) => {
      return (
        !part || part === "." || part === ".." || (!slug && part.length > MAX_CONTENT_NAME_LENGTH)
      );
    })
  )
    throw invalidPath();

  return { anchorID: absolute ? null : toUUID(anchor), segments };
};
const assertSelector = (selectors: Array<string | undefined>, required = true): void => {
  const count = selectors.filter((value) => value !== undefined).length;

  if (count > 1 || (required && count === 0)) {
    throw new ORPCError("BAD_REQUEST", {
      message: required
        ? "Use exactly one ID, path, or slugPath selector"
        : "Use only one ID, path, or slugPath selector"
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
  const slugPaths = new Map<string, string>();
  const childrenBySlug = new Map<string, string | null>();
  const parentKey = (parentID: string | null, name: string) => JSON.stringify([parentID, name]);

  for (const row of collectionsByID.values()) {
    childrenByName.set(parentKey(row.parentID, row.name), row.id);
    const slugKey = parentKey(row.parentID, toContentSlug(row.name, toCollectionID(row.id)));

    childrenBySlug.set(slugKey, childrenBySlug.has(slugKey) ? null : row.id);
  }

  const collectionPath = (id: string | null, slug = false): string => {
    const cache = slug ? slugPaths : paths;
    if (!id || id === rootID) return "/";
    if (cache.has(id)) return cache.get(id)!;

    const names: string[] = [];
    const visited = new Set<string>();
    let current: string | null = id;

    while (current) {
      const row = collectionsByID.get(current);

      if (!row || visited.has(current))
        throw new ORPCError("NOT_FOUND", { message: "Collection path is unavailable" });
      visited.add(current);
      names.unshift(slug ? toContentSlug(row.name, toCollectionID(row.id)) : row.name);
      current = row.parentID;
    }

    const path = `/${names.join("/")}`;

    cache.set(id, path);
    return path;
  };
  const resolveSegments = (parsed: ParsedContentPath, slug = false): string | null => {
    const children = slug ? childrenBySlug : childrenByName;
    let parentID = parsed.anchorID === rootID ? null : parsed.anchorID;

    if (parentID && !collectionsByID.has(parentID)) throw new ORPCError("NOT_FOUND");

    for (const name of parsed.segments) {
      const child = children.get(parentKey(parentID, name));

      if (child === null) {
        throw new ORPCError("CONFLICT", {
          message: "Multiple collections use this slug. Rename the conflicting collections."
        });
      }
      if (!child) throw new ORPCError("NOT_FOUND");
      parentID = child;
    }

    return parentID;
  };
  const resolveCollection = (
    input: CollectionSelector,
    required = true
  ): string | null | undefined => {
    assertSelector([input.collectionID, input.collectionPath, input.collectionSlugPath], required);
    if (input.collectionSlugPath !== undefined)
      return resolveSegments(parseContentPath(input.collectionSlugPath, true), true);
    if (input.collectionPath !== undefined)
      return resolveSegments(parseContentPath(input.collectionPath));
    if (input.collectionID !== undefined)
      return resolveSegments({ anchorID: toUUID(input.collectionID), segments: [] });
    return undefined;
  };
  const resolveEntryPath = (path: string, slug = false) => {
    const parsed = parseContentPath(path, slug);
    const name = parsed.segments.pop();

    if (!name) throw invalidPath();

    return { collectionID: resolveSegments(parsed, slug), name };
  };
  const entryPath = (collectionID: string | null, name: string): string =>
    `${collectionPath(collectionID).replace(/\/$/, "")}/${name}`;

  const collectionSlugPath = (id: string | null): string => collectionPath(id, true);
  const entrySlugPath = (collectionID: string | null, name: string, id: string): string =>
    `${collectionSlugPath(collectionID).replace(/\/$/, "")}/${toContentSlug(name, toEntryID(id))}`;

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

  return {
    collectionPath,
    collectionSlugPath,
    entryPath,
    entrySlugPath,
    resolveCollection,
    resolveEntryPath,
    descendantIDs,
    rootID
  };
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

const resolveEntrySlugID = async (
  database: PathDatabase,
  workspaceID: string,
  paths: ReturnType<typeof createContentPaths>,
  slugPath: string,
  snapshotID?: string
): Promise<string> => {
  const target = paths.resolveEntryPath(slugPath, true);
  const rows = snapshotID
    ? await database
        .select({ id: publishingSnapshotEntries.entryID, name: entryVersions.entryName })
        .from(publishingSnapshotEntries)
        .innerJoin(entryVersions, eq(entryVersions.id, publishingSnapshotEntries.versionID))
        .where(
          and(
            eq(publishingSnapshotEntries.workspaceID, workspaceID),
            eq(publishingSnapshotEntries.snapshotID, snapshotID),
            target.collectionID
              ? eq(publishingSnapshotEntries.collectionID, target.collectionID)
              : isNull(publishingSnapshotEntries.collectionID)
          )
        )
    : await database
        .select({ id: entries.id, name: entries.name })
        .from(entries)
        .where(
          and(
            eq(entries.workspaceID, workspaceID),
            isNull(entries.deletedAt),
            target.collectionID
              ? eq(entries.collectionID, target.collectionID)
              : or(
                  isNull(entries.collectionID),
                  paths.rootID ? eq(entries.collectionID, paths.rootID) : undefined
                )
          )
        );
  const matches = rows.filter((row) => toContentSlug(row.name, toEntryID(row.id)) === target.name);

  if (!matches.length) throw new ORPCError("NOT_FOUND");
  if (matches.length > 1)
    throw new ORPCError("CONFLICT", {
      message: "Multiple entries use this slug. Rename the conflicting entries."
    });

  return matches[0]!.id;
};

export {
  resolveEntrySlugID,
  assertSelector,
  createContentPaths,
  loadCurrentContentPaths,
  loadPublishedContentPaths,
  parseContentPath
};
export type { CollectionSelector, EntrySelector, PublishedEntrySelector };
