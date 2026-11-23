import { type CommentThread } from "@andesine/contracts/entities";
import { emitCommentThreadEvent } from "#backend/events";
import { trackEvent } from "#backend/lib/analytics";
import { getUserAuthorization, type SessionData } from "#backend/lib/policy";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Comments } from "#backend/services/comments";
import { api } from "./implement";

const emitThreadUpdate = (auth: SessionData, thread: CommentThread): CommentThread => {
  emitCommentThreadEvent(auth.workspaceID, {
    action: "comment-thread:update",
    memberID: getUserAuthorization(auth)?.memberID,
    data: thread
  });

  return thread;
};
const trackComment = (auth: SessionData, reply: boolean, suggestion: boolean) => {
  trackEvent("comment_created", auth, { reply, suggestion });
};
const handlers = api.comments;
const authorizedHandlers = handlers.use(authorized);
const commentsRouter = handlers.router({
  list: authorizedHandlers.list.handler(({ context, input }) => {
    const onChange = (thread: CommentThread) => emitThreadUpdate(context.auth, thread);

    return Comments.list({ ...input, auth: context.auth, onChange });
  }),
  createThread: authorizedHandlers.createThread.handler(async ({ context, input }) => {
    const thread = await Comments.createThread({ ...input, auth: context.auth });

    trackComment(context.auth, false, input.suggestion !== undefined);

    return emitThreadUpdate(context.auth, thread);
  }),
  reply: authorizedHandlers.reply.handler(async ({ context, input }) => {
    const thread = await Comments.reply({ ...input, auth: context.auth });

    trackComment(context.auth, true, false);

    return emitThreadUpdate(context.auth, thread);
  }),
  suggest: authorizedHandlers.suggest.handler(async ({ context, input }) => {
    const thread = await Comments.suggest({ ...input, auth: context.auth });

    trackComment(context.auth, false, true);

    return emitThreadUpdate(context.auth, thread);
  }),
  updateSuggestion: authorizedHandlers.updateSuggestion.handler(async ({ context, input }) => {
    const thread = await Comments.updateSuggestion({ ...input, auth: context.auth });

    return emitThreadUpdate(context.auth, thread);
  }),
  update: authorizedHandlers.update.handler(async ({ context, input }) => {
    return emitThreadUpdate(context.auth, await Comments.update({ ...input, auth: context.auth }));
  }),
  delete: authorizedHandlers.delete.handler(async ({ context, input }) => {
    const { deleted, thread } = await Comments.delete({ id: input.id, auth: context.auth });

    if (thread) emitThreadUpdate(context.auth, thread);

    if (deleted) {
      emitCommentThreadEvent(context.auth.workspaceID, {
        action: "comment-thread:delete",
        memberID: getUserAuthorization(context.auth)?.memberID,
        data: deleted
      });
    }
  }),
  resolve: authorizedHandlers.resolve.handler(async ({ context, input }) => {
    const { thread, changed } = await Comments.resolve({ ...input, auth: context.auth });

    if (!changed) return thread;

    if (input.resolved) trackEvent("comment_thread_resolved", context.auth, { reason: "resolved" });

    return emitThreadUpdate(context.auth, thread);
  }),
  apply: authorizedHandlers.apply.handler(async ({ context, input }) => {
    const thread = await Comments.apply({ id: input.id, auth: context.auth });

    trackEvent("comment_thread_resolved", context.auth, { reason: "suggestion_applied" });

    return emitThreadUpdate(context.auth, thread);
  }),
  setApplied: authorizedHandlers.setApplied.handler(async ({ context, input }) => {
    const thread = await Comments.setApplied({ ...input, auth: context.auth });

    if (input.applied) {
      trackEvent("comment_thread_resolved", context.auth, { reason: "suggestion_applied" });
    }

    return emitThreadUpdate(context.auth, thread);
  })
});

export { commentsRouter };
