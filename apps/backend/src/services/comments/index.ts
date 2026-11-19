import { applyCommentSuggestion } from "./apply";
import { createCommentThread } from "./create-thread";
import { deleteComment } from "./delete";
import { listCommentThreads } from "./list";
import { replyToCommentThread } from "./reply";
import { resolveCommentThread } from "./resolve";
import { updateComment } from "./update";

const Comments = {
  apply: applyCommentSuggestion,
  createThread: createCommentThread,
  delete: deleteComment,
  list: listCommentThreads,
  reply: replyToCommentThread,
  resolve: resolveCommentThread,
  update: updateComment
};

export { Comments };
