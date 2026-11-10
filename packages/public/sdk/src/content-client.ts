import type { APIResources } from "./generated/resources";
import type { ContentListOutput } from "./content-list";
import type { OperationInput, OperationOutput, RequestOptions } from "./operation";
import { paginatePages, type Page } from "./paginate";
import type { WorkspaceTypeMap } from "./workspace";

interface ContentClient<
  Workspace extends WorkspaceTypeMap = WorkspaceTypeMap
> extends ContentResources<Workspace> {
  /**
   * Iterate published entries, automatically keeping the first page's snapshot.
   *
   * @param input - List scope, filters, and page size. Set includeContent to true for full entries.
   * To resume, supply both cursor and snapshotID, or use a client from atSnapshot().
   * @param options - Options for each request. The timeout applies to each page separately.
   * @returns A lazy iterator in API order. Breaking the loop prevents further requests.
   * @throws API errors without switching to a newer snapshot, including expired snapshots.
   * @example
   * for await (const entry of client.content.paginateEntries({
   *   collectionPath: "/Tutorials", includeContent: true
   * })) console.log(entry.properties);
   */
  paginateEntries<const Input extends EntryListInput = Record<string, never>>(
    input?: Input,
    options?: ContentPaginationOptions
  ): AsyncGenerator<ContentListOutput<Input, Workspace>["data"][number]>;
  /**
   * Iterate entry pages while retaining snapshot metadata and resume cursors.
   *
   * The first response selects the snapshot; later requests omit channel and reuse that snapshot.
   * Scope and filters are reused for every page. An existing atSnapshot() binding is respected.
   * @param input - List options. Resuming requires cursor and its snapshot, with the same filters.
   * @param options - Per-page request options, including cancellation and timeout.
   * @returns Lazy pages with includeContent-dependent item types and snapshot metadata.
   * @throws API errors or an error for a missing/repeated cursor or changed response snapshot.
   */
  paginateEntryPages<const Input extends EntryListInput = Record<string, never>>(
    input?: Input,
    options?: ContentPaginationOptions
  ): AsyncGenerator<ContentListOutput<Input, Workspace>>;
  /**
   * Iterate published collections using the first page's snapshot for all later pages.
   *
   * @param input - Collection scope and page size. To resume, supply cursor and its snapshot.
   * @param options - Per-page request options. Break the loop to stop requesting pages.
   * @returns A lazy iterator of collection summaries in API order.
   * @throws API and pagination errors; unavailable snapshots are never replaced automatically.
   */
  paginateCollections(
    input?: OperationInput<"content.listCollections">,
    options?: ContentPaginationOptions
  ): AsyncGenerator<OperationOutput<"content.listCollections">["data"][number]>;
  /**
   * Iterate collection pages with snapshot metadata and resume cursors.
   *
   * @param input - List options. Use the same scope and snapshot when resuming a cursor.
   * @param options - Options applied to each request, including cancellation and timeout.
   * @returns Lazy pages pinned to the first response's snapshot or the atSnapshot() binding.
   * @throws API errors or an error for a missing/repeated cursor or changed response snapshot.
   */
  paginateCollectionPages(
    input?: OperationInput<"content.listCollections">,
    options?: ContentPaginationOptions
  ): AsyncGenerator<OperationOutput<"content.listCollections">>;
}
interface SnapshotListInput {
  channel?: string;
  snapshotID?: string;
  cursor?: string;
}
interface SnapshotPage extends Page<unknown> {
  snapshotID: string;
}

type ContentResources<Workspace extends WorkspaceTypeMap = WorkspaceTypeMap> =
  APIResources<Workspace>["content"];
type EntryListInput = OperationInput<"content.listEntries">;
type ContentPaginationOptions = RequestOptions & { response?: "data" };

const paginateSnapshotPages = async function* <
  Input extends SnapshotListInput,
  P extends SnapshotPage
>(
  list: (input: Input, options: ContentPaginationOptions) => Promise<P>,
  input: Input,
  options: ContentPaginationOptions = {}
): AsyncGenerator<P> {
  let query = { ...input };

  yield* paginatePages(
    async (cursor) => {
      const page = await list({ ...query, cursor }, { ...options, response: "data" });
      const snapshotChanged =
        query.snapshotID !== undefined && page.snapshotID !== query.snapshotID;

      if (snapshotChanged) throw new Error("Pagination returned a different snapshot");

      query = { ...query, channel: undefined, snapshotID: page.snapshotID };

      return page;
    },
    { cursor: input.cursor }
  );
};

const createContentClient = <Workspace extends WorkspaceTypeMap = WorkspaceTypeMap>(
  content: ContentResources<Workspace>
): ContentClient<Workspace> => {
  const paginateEntryPages = <const Input extends EntryListInput = Record<string, never>>(
    input: Input = {} as Input,
    options?: ContentPaginationOptions
  ) =>
    paginateSnapshotPages<Input, ContentListOutput<Input, Workspace>>(
      (query, requestOptions) => content.listEntries(query, requestOptions),
      input,
      options
    );
  const paginateCollectionPages = (
    input: OperationInput<"content.listCollections"> = {},
    options?: ContentPaginationOptions
  ) =>
    paginateSnapshotPages(
      (query, requestOptions) => content.listCollections(query, requestOptions),
      input,
      options
    );

  return {
    ...content,
    paginateEntryPages,
    async *paginateEntries(input, options) {
      for await (const page of paginateEntryPages(input, options)) yield* page.data;
    },
    paginateCollectionPages,
    async *paginateCollections(input, options) {
      for await (const page of paginateCollectionPages(input, options)) yield* page.data;
    }
  };
};

export { createContentClient };
export type { ContentClient, ContentPaginationOptions };
