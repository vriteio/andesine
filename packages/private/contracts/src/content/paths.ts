import { publicID, toUUID } from "../primitives/id";
import { MAX_CONTENT_NAME_LENGTH } from "./name";
import { ORPCError } from "@orpc/contract";

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
export { assertSelector, parseContentPath };
export type { CollectionSelector, EntrySelector, PublishedEntrySelector };

export { invalidPath };
export type { ParsedContentPath };
