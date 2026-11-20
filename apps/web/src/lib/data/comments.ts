import { query } from "@solidjs/router";
import { client } from "#web/lib/api";

type CommentThreadPage = Awaited<ReturnType<typeof client.comments.list>>;
type CommentThread = CommentThreadPage["data"][number];

/** Empty when the threads can't load. */
const commentThreadsQuery = query(async (entryID: string): Promise<CommentThread[]> => {
  const threads: CommentThread[] = [];
  let cursor: string | undefined;

  try {
    do {
      const page: CommentThreadPage = await client.comments.list({ entryID, cursor, limit: 100 });

      threads.push(...page.data);
      cursor = page.pagination.nextCursor ?? undefined;
    } while (cursor);
  } catch (error) {
    console.error(error);
  }

  return threads;
}, "comment-threads");

export { commentThreadsQuery };
export type { CommentThread };
