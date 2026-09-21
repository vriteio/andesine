import type {
  ContentSchemaMetadata,
  EntryFragment,
  EntryProperty,
  PublishedEntryContent,
  PublishedCollection
} from "./generated/schema";

/**
 * Type-only description of one workspace and content source.
 * It does not select a workspace, bind a snapshot, or validate a server response.
 * Generated collection/entry keys can include IDs and canonical paths. Unknown keys retain general SDK types.
 */
interface WorkspaceTypeMap {
  workspaceID?: string;
  source: { kind: "current" | "published"; channel?: string; snapshotID?: string };
  collections: Readonly<Record<string, WorkspaceCollection>>;
  schemas: Readonly<Record<string, WorkspaceSchema>>;
  /** Optional exact entry bindings. Omit ID or path keys when their generation is disabled. */
  entries?: Readonly<Record<string, WorkspaceEntry>>;
  /** Optional published trees keyed by collection selector. Does not affect current reads. */
  tree?: Readonly<Record<string, PublishedCollection>>;
}

/** One collection's content variants and known descendant collection selectors. */
interface WorkspaceCollection {
  id: string | null;
  path: string;
  /** Exact recorded revision IDs; null is schema-free content. An empty tuple uses general content. */
  schemaRevisionIDs: ReadonlyArray<string | null>;
  /** All descendants, not only direct children. Omit when unknown; use [] for a known leaf. */
  descendants?: readonly string[];
}

/** Effective fields for one recorded schema revision, including inherited fields. */
interface WorkspaceSchema {
  hash: string;
  properties: Readonly<Record<string, EntryProperty | undefined>>;
  fragments: Readonly<Record<string, EntryFragment | undefined>>;
}

/** An exact entry binding; its revision can be narrower than its collection's revision union. */
interface WorkspaceEntry {
  collection: string;
  schemaRevisionID: string | null;
}

interface ContentShape {
  schema: ContentSchemaMetadata | null;
  properties: Readonly<Record<string, EntryProperty | undefined>>;
  fragments: Readonly<Record<string, EntryFragment | undefined>>;
}

type GeneralContent = Pick<PublishedEntryContent, "schema" | "properties" | "fragments">;

/** Content fields for named revision types. Preserves revision unions and schema-free branches. */
type SchemaContent<Workspace extends WorkspaceTypeMap, RevisionID extends string | null> = [
  RevisionID
] extends [never]
  ? GeneralContent
  : RevisionID extends null
    ? GeneralContent & { schema: null }
    : RevisionID extends keyof Workspace["schemas"]
      ? {
          schema: { revisionID: RevisionID; hash: Workspace["schemas"][RevisionID]["hash"] };
          properties: Workspace["schemas"][RevisionID]["properties"];
          fragments: Workspace["schemas"][RevisionID]["fragments"];
        }
      : GeneralContent;

export type {
  WorkspaceTypeMap,
  WorkspaceCollection,
  WorkspaceSchema,
  WorkspaceEntry,
  SchemaContent,
  ContentShape
};
