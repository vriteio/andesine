interface Page<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean };
}
interface PaginateOptions {
  /** Start after a saved cursor. The callback must retain its original scope and snapshot. */
  cursor?: string;
}

/**
 * Iterate cursor-paginated pages, retaining their metadata.
 *
 * @param getPage - Fetch one page for the supplied cursor. The first cursor is undefined unless supplied.
 * Keep filters stable. This generic helper does not bind snapshots; use content.paginateEntryPages()
 * or content.paginateCollectionPages() for automatic published snapshot handling.
 * @param options - Optional cursor from an earlier page to resume processing.
 * @returns A lazy iterator that requests the next page only after the previous page is consumed.
 * Save pagination.nextCursor after processing a page. Break the loop to stop further requests.
 * @throws Error for a missing or repeated next cursor. Callback failures pass through unchanged.
 */
const paginatePages = async function* <P extends Page<unknown>>(
  getPage: (cursor?: string) => Promise<P>,
  options: PaginateOptions = {}
): AsyncGenerator<P> {
  const seen = new Set<string>(options.cursor ? [options.cursor] : []);

  let cursor = options.cursor;

  do {
    const page = await getPage(cursor);
    const next = page.pagination.nextCursor;

    if (page.pagination.hasMore && (!next || seen.has(next))) {
      throw new Error("Pagination returned a missing or repeated cursor");
    }

    yield page;

    if (!page.pagination.hasMore) return;

    seen.add(next!);
    cursor = next!;
  } while (cursor);
};

/**
 * Iterate items across cursor-paginated pages without collecting them in memory.
 *
 * @param getPage - Fetch one page using the cursor. Keep scope and filters stable in this callback.
 * This generic helper does not bind snapshots; content.paginateEntries() and
 * content.paginateCollections() do that automatically for published content.
 * @param options - Optional starting cursor; retain its matching scope and snapshot yourself.
 * @returns Items in API order. Break the loop to prevent further page requests.
 * @throws Pagination errors from paginatePages(), or the original callback error.
 */
const paginate = async function* <T>(
  getPage: (cursor?: string) => Promise<Page<T>>,
  options: PaginateOptions = {}
): AsyncGenerator<T> {
  for await (const page of paginatePages(getPage, options)) {
    yield* page.data;
  }
};

export { paginate, paginatePages };
export type { Page, PaginateOptions };
