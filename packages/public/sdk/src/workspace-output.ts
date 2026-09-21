import type {
  WorkspaceTypeMap,
  WorkspaceCollection,
  WorkspaceEntry,
  SchemaContent,
  ContentShape
} from "./workspace";
import type { PublishedCollection } from "./generated/schema";

// Distribute over selectors so a union with an unknown selector retains the general result.
type Lookup<Map, Key> = Key extends string
  ? string extends Key
    ? undefined
    : Key extends keyof Map
      ? Map[Key]
      : undefined
  : undefined;
type Selector<Input, ID extends string, Path extends string> =
  Input extends Record<ID, infer Key extends string>
    ? Key
    : Input extends Record<Path, infer Key extends string>
      ? Key
      : undefined;
type EntryMap<Workspace> = Workspace extends { entries: infer Entries }
  ? Entries
  : Record<never, never>;
type TreeMap<Workspace> = Workspace extends { tree: infer Tree } ? Tree : Record<never, never>;

// Omit must distribute over each shape to retain the association between revision and fields.
type ApplyContent<Base, Shape> = Shape extends ContentShape
  ? Omit<Base, keyof ContentShape> & Shape
  : Base;
type CollectionIdentity<Collection> = Collection extends WorkspaceCollection
  ? { collectionID: Collection["id"] }
  : Record<never, never>;
type EntryContent<
  Base,
  Workspace extends WorkspaceTypeMap,
  Binding
> = Binding extends WorkspaceEntry
  ? ApplyContent<Base, SchemaContent<Workspace, Binding["schemaRevisionID"]>> &
      (Workspace["source"] extends { kind: "published" }
        ? CollectionIdentity<Lookup<Workspace["collections"], Binding["collection"]>>
        : Record<never, never>)
  : Base;
type EntryOutput<Base, Workspace extends WorkspaceTypeMap, Input, ID extends string> = EntryContent<
  Base,
  Workspace,
  Lookup<EntryMap<Workspace>, Selector<Input, ID, "path">>
>;

type Descendants<Workspace extends WorkspaceTypeMap, Collection> = Collection extends {
  descendants: readonly string[];
}
  ? Lookup<Workspace["collections"], Collection["descendants"][number]>
  : undefined;
type ListCollections<
  Workspace extends WorkspaceTypeMap,
  Input,
  Collection
> = "descendants" extends keyof Input
  ? Input extends { descendants?: false | undefined }
    ? Collection
    : Collection | Descendants<Workspace, Collection>
  : Collection;
type CollectionContent<
  Base,
  Workspace extends WorkspaceTypeMap,
  Collection
> = Collection extends WorkspaceCollection
  ? ApplyContent<Base, SchemaContent<Workspace, Collection["schemaRevisionIDs"][number]>> & {
      collectionID: Collection["id"];
    }
  : Base;

/** Apply known collection shapes only to published list content; summaries stay unchanged. */
type WorkspaceListContent<
  Base,
  Workspace extends WorkspaceTypeMap,
  Input
> = Workspace["source"] extends { kind: "published" }
  ? CollectionContent<
      Base,
      Workspace,
      ListCollections<
        Workspace,
        Input,
        Lookup<Workspace["collections"], Selector<Input, "collectionID", "collectionPath">>
      >
    >
  : Base;

type TreeOutput<Base, Tree> = Tree extends PublishedCollection
  ? Omit<Base, "collection"> & { collection: Tree }
  : Base;
type SchemaOutput<Base, Shape> = Shape extends { schema: infer Schema }
  ? Schema extends null
    ? null
    : Omit<NonNullable<Base>, "revisionID" | "hash"> & Schema
  : Base;
type EntrySchemaOutput<
  Base,
  Workspace extends WorkspaceTypeMap,
  Binding
> = Binding extends WorkspaceEntry
  ? SchemaOutput<Base, SchemaContent<Workspace, Binding["schemaRevisionID"]>>
  : Base;

/** Specialize reads for their matching source; unrelated operations retain their generated types. */
type WorkspaceOperationOutput<
  Operation extends string,
  Base,
  Workspace extends WorkspaceTypeMap,
  Input
> = Operation extends "entries.get"
  ? Workspace["source"] extends { kind: "current" }
    ? EntryOutput<Base, Workspace, Input, "id">
    : Base
  : Workspace["source"] extends { kind: "published" }
    ? Operation extends "content.get"
      ? EntryOutput<Base, Workspace, Input, "entryID">
      : Operation extends "content.getSchema"
        ? EntrySchemaOutput<
            Base,
            Workspace,
            Lookup<EntryMap<Workspace>, Selector<Input, "entryID", "path">>
          >
        : Operation extends "content.getTree"
          ? TreeOutput<
              Base,
              Lookup<TreeMap<Workspace>, Selector<Input, "collectionID", "collectionPath">>
            >
          : Base
    : Base;

export type { WorkspaceListContent, WorkspaceOperationOutput };
