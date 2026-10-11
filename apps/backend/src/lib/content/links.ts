import {
  entries,
  entryVersions,
  publishingSnapshotEntries,
  type DatabaseTransaction as Database
} from "@andesine/server/database";
import {
  loadCurrentContentPaths,
  loadPublishedContentPaths,
  resolveEntrySlugID
} from "@andesine/server/content";
import { toCollectionID, toEntryID, toUUID } from "@andesine/contracts/primitives";
import type { ContentNode } from "@andesine/document";
import type { AuthorizedCollectionTree } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";

interface EntryLink {
  target: string;
  suffix: string;
}
interface AvailableEntryReference {
  id: string;
  available: true;
  path: string;
  slugPath: string;
  title: string;
  collectionID: string | null;
}
interface UnavailableEntryReference {
  id: string;
  available: false;
}

type EntryReference = AvailableEntryReference | UnavailableEntryReference;
type ContentPaths = Awaited<ReturnType<typeof loadCurrentContentPaths>>;
type EntryReferences = Record<string, EntryReference>;

const ENTRY_LINK_PREFIX = "entry:";

const parseEntryLink = (href: unknown): EntryLink | null => {
  if (typeof href !== "string" || !href.startsWith(ENTRY_LINK_PREFIX)) return null;

  const [, target = "", suffix = ""] = /^([^?#]*)(.*)$/s.exec(
    href.slice(ENTRY_LINK_PREFIX.length)
  )!;

  return { target, suffix };
};
const isEntryID = (target: string): boolean => target.startsWith("ent_");
const parseEntryID = (target: string): string | undefined => {
  try {
    const uuid = toUUID(target);

    return toEntryID(uuid) === target ? uuid : undefined;
  } catch {
    return undefined;
  }
};
/** Maps entry links; undefined keeps a link, and null removes it and keeps its text. */
const mapEntryLinks = (
  node: ContentNode,
  map: (link: EntryLink) => string | null | undefined
): ContentNode => {
  const marks = node.marks?.flatMap((mark) => {
    const link = mark.type === "link" ? parseEntryLink(mark.attrs?.href) : null;
    const href = link ? map(link) : undefined;

    if (href === undefined) return [mark];
    if (href === null) return [];

    return [{ ...mark, attrs: { ...mark.attrs, href } }];
  });

  return {
    ...node,
    ...(node.marks && { marks }),
    ...(node.content && { content: node.content.map((child) => mapEntryLinks(child, map)) })
  };
};
const getEntryLinks = (node: ContentNode): EntryLink[] => {
  const links = (node.marks || []).flatMap((mark) => {
    const link = mark.type === "link" ? parseEntryLink(mark.attrs?.href) : null;

    return link ? [link] : [];
  });

  return [...links, ...(node.content || []).flatMap(getEntryLinks)];
};
const contentLinkInvalidError = (href: string) => {
  return new ORPCError("CONTENT_LINK_INVALID", {
    status: 409,
    message: `Link ${href} doesn't point to an entry`,
    data: {
      href,
      hints: [
        "Link to entries with entry:<entryID> or entry:<path>, using a path or slug path from entries.list or entries.get."
      ]
    }
  });
};

/**
 * Resolves `entry:<path>` links to `entry:<entryID>` and checks that the caller can read the
 * linked entries.
 * @throws CONTENT_LINK_INVALID for a link that doesn't point to an entry.
 */
const resolveEntryLinks = async (
  database: Database,
  workspaceID: string,
  document: ContentNode,
  authorization: AuthorizedCollectionTree,
  loadedPaths?: ContentPaths
): Promise<ContentNode> => {
  const links = getEntryLinks(document);

  if (!links.length) return document;

  const paths = loadedPaths ?? (await loadCurrentContentPaths(database, workspaceID));
  const targets = new Map<string, string>();
  const findEntryByName = async (target: string): Promise<string | undefined> => {
    try {
      const { collectionID, name } = paths.resolveEntryPath(decodeURI(target));
      const [entry] = await database
        .select({ id: entries.id })
        .from(entries)
        .where(
          and(
            eq(entries.workspaceID, workspaceID),
            collectionID ? eq(entries.collectionID, collectionID) : isNull(entries.collectionID),
            eq(entries.name, name),
            isNull(entries.deletedAt)
          )
        );

      return entry?.id;
    } catch {
      return undefined;
    }
  };
  // Reads show links by slug path, whose segments don't match names.
  const findEntryByPath = async (target: string): Promise<string | undefined> => {
    const entryID = await findEntryByName(target);

    if (entryID) return entryID;

    try {
      return await resolveEntrySlugID(database, workspaceID, paths, decodeURI(target));
    } catch {
      return undefined;
    }
  };

  for (const { target } of links) {
    if (targets.has(target)) continue;

    const entryID = isEntryID(target) ? parseEntryID(target) : await findEntryByPath(target);

    if (entryID) targets.set(target, toEntryID(entryID));
  }

  const ids = [...new Set(targets.values())];
  const rows = ids.length
    ? await database
        .select({ id: entries.id, collectionID: entries.collectionID })
        .from(entries)
        .where(
          and(
            eq(entries.workspaceID, workspaceID),
            inArray(entries.id, ids.map(toUUID)),
            isNull(entries.deletedAt)
          )
        )
    : [];
  // Unreadable entries fail like missing ones, so a link doesn't show that a path exists.
  const existing = new Set(
    rows
      .filter(({ collectionID }) => authorization.canEntry(collectionID, "entry:read"))
      .map(({ id }) => toEntryID(id))
  );

  return mapEntryLinks(document, ({ target, suffix }) => {
    const entryID = targets.get(target);

    if (!entryID || !existing.has(entryID)) {
      throw contentLinkInvalidError(`${ENTRY_LINK_PREFIX}${target}${suffix}`);
    }

    return `${ENTRY_LINK_PREFIX}${entryID}${suffix}`;
  });
};
/** Details of linked entries. Deleted and unreadable entries look the same, so nothing leaks. */
const loadEntryReferences = async (
  database: Database,
  workspaceID: string,
  document: ContentNode,
  authorization?: AuthorizedCollectionTree,
  loadedPaths?: ContentPaths
): Promise<EntryReferences> => {
  const ids = [...new Set(getEntryLinks(document).map(({ target }) => target))].filter(isEntryID);

  if (!ids.length) return {};

  const uuids = ids.flatMap((id) => parseEntryID(id) ?? []);
  const paths = loadedPaths ?? (await loadCurrentContentPaths(database, workspaceID));
  const rows = uuids.length
    ? await database
        .select({ id: entries.id, name: entries.name, collectionID: entries.collectionID })
        .from(entries)
        .where(
          and(
            eq(entries.workspaceID, workspaceID),
            inArray(entries.id, uuids),
            isNull(entries.deletedAt)
          )
        )
    : [];
  const rowsByID = new Map(rows.map((row) => [toEntryID(row.id), row]));

  return Object.fromEntries(
    ids.map((id): [string, EntryReference] => {
      const row = rowsByID.get(id);
      const readable = row && (authorization?.canEntry(row.collectionID, "entry:read") ?? true);

      if (!row || !readable) return [id, { id, available: false }];

      return [
        id,
        {
          id,
          available: true,
          path: paths.entryPath(row.collectionID, row.name),
          slugPath: paths.entrySlugPath(row.collectionID, row.name, row.id),
          title: row.name,
          collectionID: row.collectionID ? toCollectionID(row.collectionID) : null
        }
      ];
    })
  );
};
/** Shows available entry links by slug path, as MDX and blocks present them. */
const withEntryLinkPaths = (document: ContentNode, references: EntryReferences): ContentNode => {
  return mapEntryLinks(document, ({ target, suffix }) => {
    const reference = references[target];

    if (reference?.available) return `${ENTRY_LINK_PREFIX}${reference.slugPath}${suffix}`;
  });
};
const loadPublishedEntryPaths = async (
  database: Database,
  workspaceID: string,
  snapshotID: string
): Promise<Map<string, string>> => {
  const paths = await loadPublishedContentPaths(database, workspaceID, snapshotID);
  const rows = await database
    .select({
      id: publishingSnapshotEntries.entryID,
      collectionID: publishingSnapshotEntries.collectionID,
      name: entryVersions.entryName
    })
    .from(publishingSnapshotEntries)
    .innerJoin(entryVersions, eq(entryVersions.id, publishingSnapshotEntries.versionID))
    .where(
      and(
        eq(publishingSnapshotEntries.workspaceID, workspaceID),
        eq(publishingSnapshotEntries.snapshotID, snapshotID)
      )
    );

  return new Map(
    rows.map((row) => [toEntryID(row.id), paths.entrySlugPath(row.collectionID, row.name, row.id)])
  );
};
/** Links to published entries become their slug paths; other entry links become plain text. */
const resolvePublishedLinks = (document: ContentNode, paths: Map<string, string>): ContentNode => {
  return mapEntryLinks(document, ({ target, suffix }) => {
    const path = paths.get(target);

    return path ? `${path}${suffix}` : null;
  });
};

export {
  loadEntryReferences,
  loadPublishedEntryPaths,
  resolveEntryLinks,
  resolvePublishedLinks,
  withEntryLinkPaths
};
export type { ContentPaths, EntryReference, EntryReferences };
