import { type CommentThread } from "@andesine/contracts/entities";
import { type Page, toPage } from "#backend/lib/api/pagination";
import { fetchCommentThreads, resolveCommentEntry } from "#backend/lib/comments";
import { withAuthorization } from "#backend/lib/policy";
import { DEFAULT_PAGE_SIZE } from "@andesine/contracts/limits";

interface ListCommentThreadsInput {
  entryID: string;
  resolved?: boolean;
  cursor?: string;
  limit?: number;
}

const listCommentThreads = withAuthorization<
  ListCommentThreadsInput,
  { collectionID: string | null },
  Page<CommentThread>
>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "entry:read", collectionID: resolved.collectionID }]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentEntry(database, workspaceID, input.entryID);
    }
  },
  async ({ database, input, workspaceID }) => {
    const limit = input.limit ?? DEFAULT_PAGE_SIZE;
    const threads = await fetchCommentThreads(database, workspaceID, { ...input, limit });

    return toPage(threads, limit);
  }
);

export { listCommentThreads };
