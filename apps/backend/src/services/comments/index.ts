import { applyCommentSuggestion } from "./apply";
import { createCommentThread } from "./create-thread";
import { deleteComment } from "./delete";
import { listCommentThreads } from "./list";
import { replyToCommentThread } from "./reply";
import { resolveCommentThread } from "./resolve";
import { suggestChange } from "./suggest";
import { updateComment } from "./update";
import { updateSuggestion } from "./update-suggestion";

const Comments = {
  apply: applyCommentSuggestion,
  createThread: createCommentThread,
  delete: deleteComment,
  list: listCommentThreads,
  reply: replyToCommentThread,
  resolve: resolveCommentThread,
  suggest: suggestChange,
  update: updateComment,
  updateSuggestion
};

export { Comments };
